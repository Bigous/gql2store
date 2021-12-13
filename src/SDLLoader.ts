import graphql, { GraphQLOutputType } from 'graphql';
import { readFileSync } from 'node:fs';

import { SDLObjectType, SDLObjectTypeMap, SDLProcessedSchema } from './types/definitions';


function generateDependeciyRelations(objects: SDLObjectTypeMap) : void {
	let ok = Object.keys(objects);
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = type.getFields();
		type.dependencies = Object.keys(fields).filter(element => {
			let t = fields[element].type;
			return (t instanceof graphql.GraphQLObjectType) || (t instanceof graphql.GraphQLList);
		}).map(element => {
			return {
				fieldName: element,
				typeName: fields[element].type instanceof graphql.GraphQLObjectType ? (fields[element].type as SDLObjectType).name : (fields[element].type as graphql.GraphQLList<graphql.GraphQLObjectType>).ofType.name
			};
		});
	});
}

function generateCrossReference(objects: SDLObjectTypeMap) : void {
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

function generateFragments(objects: SDLObjectTypeMap) : void {
	let ok = Object.keys(objects);
	// TODO: need to be correctly implemented
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = Object.keys(type.getFields()).filter(fieldName => {
			let field = type.getFields()[fieldName];
			let typeField = undefined;
			if (field.type instanceof graphql.GraphQLObjectType) {
				typeField = objects[fieldName];
			} else if (field.type instanceof graphql.GraphQLList && field.type.ofType instanceof graphql.GraphQLObjectType) {
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
	const schema = graphql.buildSchema(readFileSync(sdlFileName, 'utf8'));

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
			if (type instanceof graphql.GraphQLObjectType) {
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

					if(!object.dependencies)
						object.dependencies = [];
					
					if(!object.dependantTypes)
						object.dependantTypes = [];

					types.objects[type.name] = object;
				}
			} else if (type instanceof graphql.GraphQLInterfaceType) {
				types.interfaces[type.name] = type;
			} else if (type instanceof graphql.GraphQLUnionType) {
				types.unions[type.name] = type;
			} else if (type instanceof graphql.GraphQLScalarType) {
				types.scalars[type.name] = type;
			} else if (type instanceof graphql.GraphQLEnumType) {
				types.enums[type.name] = type;
			} else if (type instanceof graphql.GraphQLInputObjectType) {
				types.inputs[type.name] = type;
			}
		}
	});

	generateDependeciyRelations(types.objects);
	generateCrossReference(types.objects);
	generateFragments(types.objects);

	return types;
}