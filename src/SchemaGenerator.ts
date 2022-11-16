import { GraphQLArgument, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType } from 'graphql';
import { FileGenerator } from './FileGenerator';
import { GenConfig, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camel2snake, camelize, getConfigByType, getRootParentsConfigByType, objectFromField } from './utils';

export class SchemaGenerator extends FileGenerator {
	folder = 'schema';
	sufix = '.schema.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): void {
		// this type will be declarated in root type
		if (getRootParentsConfigByType(type, config?.schemas).some(t => t.inlineChildren)) {
			console.log(type.name, getRootParentsConfigByType(type, config?.schemas))
			return;
		}

		super.generateFileFor(type, types, config);
	}

	getData(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig) {
		return get_imports_schema_gql(type, types, config)
		+ get_queries(type, types)
		+ get_mutations(type, types);
	}
}

function get_imports_schema_gql(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig) {
	const typeConfig = getConfigByType(type, config?.schemas);

	const fields = type.getFields();
	const fieldNames = Object.keys(fields);

	const nameCamel = camelize(type.name);
	const typeNameSchema = camel2snake(camelize(type.name + 'Schema')).toUpperCase();

	const idType = camelize('id ' + type.name);
	type.id = fieldNames.find(v => v === idType); // only set id if this type has it

	// in recursive entities, avoid definition loop
	const children = type.children.filter(dep => dep.typeName !== type.name);
	const recusiveDeps = type.children.filter(dep => dep.typeName === type.name);

	// imports
	let str = `import { schema } from 'normalizr';\n`;

	if (!typeConfig?.inlineChildren) {
		str += children.map(child =>
			`\nimport { ${child.typeName.toUpperCase()}_SCHEMA } from './${camel2kebab(camelize(child.typeName))}.schema';`
		).join('') + (children.length ? '\n' : '')
	}

	// schema
	str += `\nexport const ${typeNameSchema} = new schema.Entity('${nameCamel}', {`;

	if (!typeConfig?.inlineChildren) {
		str += children.map(child =>
			`\n\t${child.fieldName}: [${child.typeName.toUpperCase()}_SCHEMA],`
		).join('') + (children.length ? '\n' : '')
	}

	str += `}${type.id ? `, { idAttribute: '${type.id}' }` : ''});\n`;

	// schema recursive deps
	if (recusiveDeps.length) {
		str += `
${typeNameSchema}.define({
${
	recusiveDeps.map(dep =>
		`\t${dep.fieldName}: [${dep.typeName.toUpperCase()}_SCHEMA],`
	).join('\n')
}
});
`
	}

	// GQL
	if (fieldNames.length) {

		const makeGql = (type: GraphQLObjectType, allInline = false, childrenMade: GraphQLObjectType[] = []): string => {
			const currFields = type.getFields();
			const currFieldNames = Object.keys(currFields);

			const childrenToMakeGql: GraphQLObjectType[] = [];

			let makeGqlStr = `\nexport const ${type.name}GQL = \``;

			makeGqlStr += currFieldNames.reduce((str, fieldName) => {
				const currField = currFields[fieldName];

				const fieldType = objectFromField(currField.type);

				if (fieldType) {
					if (allInline) {
						if (fieldType.name !== type.name && !childrenMade.find(v => v.name === fieldType.name) && !childrenToMakeGql.find(v => v.name === fieldType.name)) {
							childrenToMakeGql.push(fieldType);
						}
						return `${str}\n\t${fieldName} {\${${fieldType.name}GQL}}`;
					}

					// Here we filter out the fields that are object or list of objects. This happens because we wanna query the graphql for this fields only when we need them and not all the time.
					return str;
				}

				return str + '\n\t' + fieldName;
			}, '');

			makeGqlStr += `\n\`;\n`;


			if (childrenToMakeGql.length) {
				return childrenToMakeGql.reduce((r, child) => makeGql(child, allInline, [...childrenMade, ...childrenToMakeGql]) + r, '') + makeGqlStr;
			}
			return makeGqlStr;
		}

		str += makeGql(type, typeConfig?.inlineChildren);

		// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
		type.exports.push(`${type.name}GQL`);
	}

	return str;
}

function get_queries(type: SDLObjectType, types: SDLProcessedSchema) {
	// Fields no PrivateQuery são as queries disponíveis no graphql.
	const queries = types.PrivateQuery && Object.values(types.PrivateQuery.getFields())
		.filter(query => {
			// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type) ou que retornam um array de objetos do tipo que estamos analisando (type).
			return (query.type instanceof GraphQLObjectType && query.type.name == type.name)
					|| (query.type instanceof GraphQLList && 'name' in query.type.ofType && query.type.ofType.name == type.name);
		});

	if (!queries || !queries.length) return '';

	return `
// Queries
${
	queries.map(query => {
		const QueryArgsName = query.args.length ? `Get${query.name}Args` : undefined;

		type.queries.push({ gqlQueryName: query.name, argsName: QueryArgsName });

		if (!QueryArgsName) return '';

		// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
		type.exports.push(QueryArgsName);

		const args = query.args.map(arg => {
			if ('name' in arg.type) return `\n\t${arg.name}: '${arg.type.name}',`;
			return '';
		});

		return `\nexport const ${QueryArgsName} = {${args.join('')}\n};\n`
	}).join('')
}`;
}

function get_mutations(type: SDLObjectType, types: SDLProcessedSchema) {
	// Fields no PrivateMutation são as mutations disponíveis no graphql.
	const mutations = types.PrivateMutation && Object.values(types.PrivateMutation.getFields())
		.filter(mutation => {
			// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type)
			// ou que retornam um array de objetos do tipo que estamos analisando (type).
			return (mutation.type instanceof GraphQLObjectType && mutation.type.name == type.name)
				|| (mutation.type instanceof GraphQLList && 'name' in mutation.type.ofType && (mutation.type.ofType.name == type.name));
		});

	if(!mutations || !mutations.length) return '';

	return `
// Mutations
${
	mutations.map(mutation => {
		const MutationArgsName = mutation.args.length ? `${mutation.name}Args` : undefined;

		const getTypeName = (arg: any): string => { // any instead of GraphQLArgument, since ofType is not a common type, but recursivity is needed
			if (arg.type instanceof GraphQLNonNull) return `${getTypeName(arg.type.ofType)}!`;
			if (arg.type instanceof GraphQLList) return `[${getTypeName(arg.type.ofType)}]`;
			return arg.type?.name || arg.name || '';
		};

		type.mutations.push({ gqlMutationName: mutation.name, argsName: MutationArgsName });

		if (!MutationArgsName) return '';

		// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
		type.exports.push(MutationArgsName);

		const args = mutation.args.map(arg => {
			const typeName = getTypeName(arg);
			return typeName && `\n\t${arg.name}: '${typeName}',`;
		});

		return `\nexport const ${MutationArgsName} = {${args.join('')}\n};\n`
	}).join('')
}`;
}
