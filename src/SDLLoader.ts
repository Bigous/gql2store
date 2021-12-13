import { buildSchema, GraphQLObjectType, GraphQLList, GraphQLInterfaceType, GraphQLUnionType, GraphQLScalarType, GraphQLEnumType, GraphQLInputObjectType } from 'graphql';
import { readFileSync } from 'node:fs';

import { SDLObjectType, SDLObjectTypeMap, SDLProcessedSchema } from './types/definitions';


function generateDependeciyRelations(objects: SDLObjectTypeMap): void {
	let ok = Object.keys(objects);
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = type.getFields();
		type.dependencies = Object.keys(fields).filter(element => {
			let t = fields[element].type;
			return (t instanceof GraphQLObjectType) || (t instanceof GraphQLList);
		}).map(element => {
			return {
				fieldName: element,
				typeName: fields[element].type instanceof GraphQLObjectType ? (fields[element].type as SDLObjectType).name : (fields[element].type as GraphQLList<GraphQLObjectType>).ofType.name
			};
		});
	});
}

function generateCrossReference(objects: SDLObjectTypeMap): void {
	let ok = Object.keys(objects);
	ok.forEach(typeName1 => {
		let type = objects[typeName1];
		type.dependantTypes = [];
		ok.forEach(typeName2 => {
			if (typeName1 !== typeName2) {
				let type2 = objects[typeName2];
				let depandant = type2.dependencies.find(i => i.typeName === typeName1);
				if (depandant) {
					type.dependantTypes.push({ type: type2, fieldName: depandant.fieldName });
				}
			}
		});
	});
}

function generateFragments(objects: SDLObjectTypeMap): void {
	let ok = Object.keys(objects);
	// TODO: need to be correctly implemented
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = Object.keys(type.getFields()).filter(fieldName => {
			let field = type.getFields()[fieldName];
			let typeField = undefined;
			if (field.type instanceof GraphQLObjectType) {
				typeField = objects[fieldName];
			} else if (field.type instanceof GraphQLList && field.type.ofType instanceof GraphQLObjectType) {
				typeField = objects[field.type.ofType.name];
			} else {
				return false;
			}
			return typeField && typeField.exports.indexOf(fieldName) === -1;
		});

	});
}

/**
 * Loads and processes SDL schema.
 * @param sdlFileName File with the GraphQL Schema Definition.
 * @returns SDLProcessedSchema with the processed schema.
 */
export function loadSchema(sdlFileName: string): SDLProcessedSchema {
	const schema = buildSchema(readFileSync(sdlFileName, 'utf8'));

	let types: SDLProcessedSchema = {
		scalars: {},
		objects: {},
		interfaces: {},
		unions: {},
		enums: {},
		inputs: {},
	};

	const typeMap = schema.getTypeMap();

	Object.keys(typeMap).forEach(element => {
		let type = typeMap[element];
		if (!type.name.startsWith('__')) {
			if (type instanceof GraphQLObjectType) {
				let object: SDLObjectType = type as SDLObjectType;
				if (object.name == 'PrivateQuery') {
					types.PrivateQuery = type;
				} else if (type.name == 'PrivateMutation') {
					types.PrivateMutation = type;
				} else {
					if (!object.exports)
						object.exports = [];

					if (!object.queries)
						object.queries = [];

					if (!object.mutations)
						object.mutations = [];

					if (!object.dependencies)
						object.dependencies = [];

					if (!object.dependantTypes)
						object.dependantTypes = [];

					types.objects[type.name] = object;
				}
			} else if (type instanceof GraphQLInterfaceType) {
				types.interfaces[type.name] = type;
			} else if (type instanceof GraphQLUnionType) {
				types.unions[type.name] = type;
			} else if (type instanceof GraphQLScalarType) {
				types.scalars[type.name] = type;
			} else if (type instanceof GraphQLEnumType) {
				types.enums[type.name] = type;
			} else if (type instanceof GraphQLInputObjectType) {
				types.inputs[type.name] = type;
			}
		}
	});

	generateDependeciyRelations(types.objects);
	generateCrossReference(types.objects);
	generateFragments(types.objects);

	return types;
}