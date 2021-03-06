import { GraphQLArgument, GraphQLList, GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { FileGenerator } from './FileGenerator';
import { SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2snake, camelize } from './utils';

export class SchemaGenerator extends FileGenerator {
	folder = 'schema';
	sufix = '.schema.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema) {
		return getHeaderSchemaStringFor(type)
		+ getQueriesSchemaStringFor(type, types)
		+ getMutationSchemaStringFor(type, types);
	}
}

function getHeaderSchemaStringFor(type: SDLObjectType) {
	const fields = Object.keys(type.getFields());
	const name = type.name;
	const nameCamel = camelize(name);
	const typeNameSchema = camel2snake(camelize(type.name + 'Schema')).toUpperCase();

	type.id = camelize('id ' + type.name);

	// in recursive entities, avoid definition loop
	const dependencies = type.dependencies.filter(dep => dep.typeName !== name);
	const recusiveDeps = type.dependencies.filter(dep => dep.typeName === name);

	const data =
`import { schema } from 'normalizr';
${

	dependencies.map(dep =>
		`\nimport { ${dep.typeName.toUpperCase()}_SCHEMA } from './${dep.typeName.toLowerCase()}.schema';`
	).join('') + (dependencies.length ? '\n' : '')

}
export const ${typeNameSchema} = new schema.Entity('${nameCamel}', {${

	dependencies.map(dep =>
		`\n\t${dep.fieldName}: [${dep.typeName.toUpperCase()}_SCHEMA],`
	).join('') + (dependencies.length ? '\n' : '')

}}, { idAttribute: '${type.id}' });
${

	recusiveDeps.length
		? `
${typeNameSchema}.define({
${
	recusiveDeps.map(dep =>
		`\t${dep.fieldName}: [${dep.typeName.toUpperCase()}_SCHEMA],`
	).join('\n')
}
});
`
		: ''

}
export const ${name}GQL = \`
	${fields.filter(e => {
		// Here we filter out the fields that are object or list of objects. This happens because we wanna query the graphql for this fields only when we need them and not all the time.
		const t = type.getFields();
		return !(t[e].type instanceof GraphQLObjectType || t[e].type instanceof GraphQLList);
	}).join('\n\t')}
\`;
`;

	// Para facilitar a gera????o do c??digo de imports nos DAOs, os exports do schema s??o guardados no type em quest??o chamando de exports.
	type.exports.push(`${name}GQL`);

	return data;
}

function getQueriesSchemaStringFor(type: SDLObjectType, types: SDLProcessedSchema) {
	if (!types.PrivateQuery) return '';

	// Fields no PrivateQuery s??o as queries dispon??veis no graphql.
	const queries = Object.values(types.PrivateQuery.getFields())
		.filter(query => {
			// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type)
			// ou que retornam um array de objetos do tipo que estamos analisando (type).
			return (query.type instanceof GraphQLObjectType && query.type.name == type.name)
				|| (query.type instanceof GraphQLList && 'name' in query.type.ofType && query.type.ofType.name == type.name);
		});

	return `
// Queries
${
	queries.map(query => {
		const GetNameArgs = `Get${query.name}Args`;

		// Para facilitar a gera????o do c??digo de imports nos DAOs, os exports do schema s??o guardados no type em quest??o chamando de exports.
		type.exports.push(GetNameArgs);
		type.queries.push({ gqlQueryName: query.name, argsName: GetNameArgs });

		const args = query.args.map(arg => 'name' in arg.type ? `\n\t${arg.name}: '${arg.type.name}',` : '');

		return `
export const ${GetNameArgs} = {${
	args.join('') + (args.length ? '\n' : '')
}};
`;
	}).join('')
}`;
}

function getMutationSchemaStringFor(type: SDLObjectType, types: SDLProcessedSchema) {
	if(!types.PrivateMutation) return '';

	// Fields no PrivateMutation s??o as mutations dispon??veis no graphql.
	const mutations = Object.values(types.PrivateMutation.getFields())
		.filter(mutation => {
			// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type)
			// ou que retornam um array de objetos do tipo que estamos analisando (type).
			return (mutation.type instanceof GraphQLObjectType && mutation.type.name == type.name)
				|| (mutation.type instanceof GraphQLList && 'name' in mutation.type.ofType && (mutation.type.ofType.name == type.name));
		});

	return `
// Mutations
${
	mutations.map(mutation => {
		const NameArgs = `${mutation.name}Args`;

		const getTypeName = (arg: GraphQLArgument) => {
			if (arg.type instanceof GraphQLNonNull && 'name' in arg.type.ofType) return `${arg.type.ofType.name}!`;
			if (arg.type instanceof GraphQLList && 'name' in arg.type.ofType) return `[${arg.type.ofType.name}]`;
			if ('name' in arg.type) arg.type.name;

			return '';
		};

		// Para facilitar a gera????o do c??digo de imports nos DAOs, os exports do schema s??o guardados no type em quest??o chamando de exports.
		type.exports.push(NameArgs);
		type.mutations.push({ gqlMutationName: mutation.name, argsName: NameArgs });

		const args = mutation.args.map(arg => {
			const typeName = getTypeName(arg);
			return typeName && `\n\t${arg.name}: '${typeName}',`;
		});

		return `
export const ${NameArgs} = {${
	args.join('') + (args.length ? '\n' : '')
}};
`;
	}).join('')
}`;
}
