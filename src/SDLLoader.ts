import { buildSchema, GraphQLObjectType, GraphQLList, GraphQLInterfaceType, GraphQLUnionType, GraphQLScalarType, GraphQLEnumType, GraphQLInputObjectType, GraphQLNonNull } from 'graphql';
import { readFileSync } from 'node:fs';

import { SDLObjectType, SDLObjectTypeMap, SDLProcessedSchema } from './types/definitions';
import { objectFromField } from './utils';


function generateChildrenRelations(types: SDLObjectTypeMap): void {
	const typeNames = Object.keys(types);

	typeNames.forEach(typeName => {
		const type = types[typeName];
		const fields = type.getFields();

		type.children = Object.keys(fields)
			.filter(fieldName => {
				return objectFromField(fields[fieldName].type);
			})
			.map(fieldName => {
				return {
					fieldName,
					typeName: objectFromField(fields[fieldName].type)?.name || ''
				};
			});
	});
}

function generateCrossReference(types: SDLObjectTypeMap): void {
	const typeNames = Object.keys(types);

	typeNames.forEach(typeName1 => {
		const type1 = types[typeName1];
		type1.parentTypes = [];

		typeNames.forEach(typeName2 => {
			if (typeName1 !== typeName2) {
				const type2 = types[typeName2];
				const parent = type2.children.find(i => i.typeName === typeName1);

				if (parent) {
					type1.parentTypes.push({ type: type2, fieldName: parent.fieldName });
				}
			}
		});
	});
}

function generateFragments(types: SDLObjectTypeMap): void {
	const ok = Object.keys(types);
	// TODO: need to be correctly implemented
	ok.forEach(typeName => {
		const type = types[typeName];

		const fields = Object.keys(type.getFields()).filter(fieldName => {
			const field = type.getFields()[fieldName];
			let typeField = undefined;

			if (field.type instanceof GraphQLObjectType) {
				typeField = types[fieldName];
			} else if (field.type instanceof GraphQLList && field.type.ofType instanceof GraphQLObjectType) {
				typeField = types[field.type.ofType.name];
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

	const types: SDLProcessedSchema = {
		scalars: {},
		objects: {},
		interfaces: {},
		unions: {},
		enums: {},
		inputs: {},
	};

	const typeMap = schema.getTypeMap();

	Object.keys(typeMap).forEach(element => {
		const type = typeMap[element];

		if (!type.name.startsWith('__')) {
			if (type instanceof GraphQLObjectType) {
				const object: SDLObjectType = type as SDLObjectType;
				if (object.name == 'PrivateQuery') {
					types.PrivateQuery = type;
				} else if (type.name == 'PrivateMutation') {
					types.PrivateMutation = type;
				} else {
					if (!object.exports) object.exports = [];
					if (!object.queries) object.queries = [];
					if (!object.mutations) object.mutations = [];
					if (!object.children) object.children = [];
					if (!object.parentTypes) object.parentTypes = [];

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

	generateChildrenRelations(types.objects);
	generateCrossReference(types.objects);
	generateFragments(types.objects);

	return types;
}