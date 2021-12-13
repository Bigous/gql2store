import { GraphQLList, GraphQLNonNull, GraphQLObjectType } from "graphql";
import { FileGenerator } from "./FileGenerator";
import { SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camelize } from "./utils";

export class SchemaGenerator extends FileGenerator {
	folder: string = 'schema';
	sufix: string = '.schema.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		let name = type.name;
		let data = getHeaderSchemaStringFor(type) +
			getQueriesSchemaStringFor(type, types) +
			getMutationSchemaStringFor(type, types);
		return data;
	}
}

function getHeaderSchemaStringFor(type: SDLObjectType): string {
	let fields = Object.keys(type.getFields());
	let name = type.name;
	let nameLower = name.toLowerCase();
	let nameUpper = name.toUpperCase();
	let nameCamel = camelize(name);
	let id = fields.find(element => {
		let e = element.toLowerCase();
		return e.startsWith('id') && e.endsWith(nameLower);
	});
	type.id = id;
	let dependencies = type.dependencies;
	let data = `
import { schema } from 'normalizr';
${dependencies.map(element => {
		return `import { ${element.typeName.toUpperCase()}_SCHEMA } from './${element.typeName.toLowerCase()}.schema';`;
	}).join('\n') + (dependencies.length > 0 ? '\n' : '')
		}
export const ${nameUpper}_SCHEMA = new schema.Entity('${nameCamel}', {${dependencies.map(element => {
			return `\n\t${element.fieldName}: [${element.typeName.toUpperCase()}_SCHEMA],`;
		}).join('') + (dependencies.length > 0 ? '\n' : '')
		}}, { idAttribute: '${id}' });

export const ${name}GQL = \`
  ${fields.filter(e => {
			// Here we filter out the fields that are object or list of objects. This happens because we wanna query the graphql for this fields only when we need them and not all the time.
			let t = type.getFields();
			return !(t[e].type instanceof GraphQLObjectType || t[e].type instanceof GraphQLList);
		}).join('\n  ')}
\`;
`;

	// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
	type.exports.push(`${name}GQL`);

	return data;
}

function getQueriesSchemaStringFor(type: SDLObjectType, types: SDLProcessedSchema) {
	let queries = types.PrivateQuery;
	if (!queries) return '';

	let data = '\n// Queries\n';

	// Fields no PrivateQuery são as queries disponíveis no graphql.
	let fields = queries.getFields();
	Object.keys(fields).forEach(eName => {
		let e = fields[eName];
		// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type) 
		// ou que retornam um array de objetos do tipo que estamos analisando (type).
		if ((e.type instanceof GraphQLObjectType && e.type.name == type.name) ||
			(e.type instanceof GraphQLList && (e.type as GraphQLList<GraphQLObjectType>).ofType.name == type.name)) {
			let name = `Get${e.name}Args`;

			// TODO: Remover any
			let args = e.args.map(a => `  ${a.name}: '${(a.type as any).name}',\n`);
			data += `\nexport const ${name} = {\n${args.join('')}};\n`;

			// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
			type.exports.push(name);
			type.queries.push({ gqlQueryName: e.name, argsName: name });
		}

	});

	return data;
}

function getMutationSchemaStringFor(type: SDLObjectType, types: SDLProcessedSchema) {
	let mutations = types.PrivateMutation;
	if(!mutations) return '';

	let data = '\n// Mutations\n';

	// Fields no PrivateMutation são as mutations disponíveis no graphql.
	let fields = mutations.getFields();
	Object.keys(fields).forEach(eName => {
		let e = fields[eName];
		// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type)
		// ou que retornam um array de objetos do tipo que estamos analisando (type).
		if ((e.type instanceof GraphQLObjectType && e.type.name == type.name) ||
			(e.type instanceof GraphQLList && (e.type as GraphQLList<GraphQLObjectType>).ofType.name == type.name)) {
			let name = `${e.name}Args`;
			let args = e.args.map(a => {
				let typeName = (a.type as any).name;
				if (a.type instanceof GraphQLNonNull)
					typeName = `${(a.type.ofType as any).name}!`;
				else if (a.type instanceof GraphQLList)
					typeName = `[${(a.type.ofType as any).name}]`;
				return `  ${a.name}: '${typeName}',\n`;
			});
			data += `\nexport const ${name} = {\n${args.join('')}};\n`;

			// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
			type.exports.push(name);
			type.mutations.push({ gqlMutationName: e.name, argsName: name });
		}
	});

	return data;
}
