import path from 'node:path'
import { existsSync, mkdirSync, writeFile } from 'node:fs';

import { GraphQLEnumType, GraphQLField, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType } from 'graphql';

import { FileGenerator } from "./FileGenerator";
import { SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camel2kebab, camelize } from "./utils";

const scalarMap: { [key: string]: string } = {
	'JSON': 'any',
	'NullString': 'null | string',
	'UUID': 'string',
	//'DateTime': 'Date',
	'DateTime': 'string',
	'Boolean': 'boolean',
	'Int': 'number',
	'Float': 'number',
	'String': 'string',
	'ID': 'string',
	'EmailAddress': 'string',
	'NullUUID': 'null | string',
};

export class TypesGenerator extends FileGenerator {
	folder: string = 'types';
	sufix: string = '.d.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema) {
		let typeDependences: Array<string> = [];
		let useEnums = false;

		const typeFields = type.getFields();

		const interfaceMembers = Object.keys(typeFields).map(fieldName => {
			const field = typeFields[fieldName];

			const nonNull = field.type instanceof GraphQLNonNull;

			const fieldType = field.type instanceof GraphQLNonNull && 'ofType' in field.type
				? field.type.ofType
				: field.type;

			let fieldTypeName = '';

			if (fieldType instanceof GraphQLList) {
				fieldTypeName = 'string[]'; // por definição é sempre string, mas poderia retornar o tipo correto ou string.
			} else if (fieldType instanceof GraphQLObjectType) {
				fieldTypeName = fieldType.name;
				typeDependences.push(fieldTypeName);
			} else if (fieldType instanceof GraphQLScalarType) {
				fieldTypeName = scalarMap[fieldType.name] || fieldType.name;
			} else if (fieldType instanceof GraphQLEnumType) {
				fieldTypeName = `valueof<typeof enums.${fieldType.name.replace('Enum', 'Types')}>`;
				useEnums = true;
			}

			return `\t${fieldName}${nonNull ? '' : '?'}: ${fieldTypeName};`;
		});

		let data =
`${
	useEnums ?
`import enums from '@/enum/enum';
import { valueof } from './shared.d';

` : ''
}${

	typeDependences.map(typeName =>
		`import { ${typeName} } from './${camel2kebab(typeName)}.d';\n`
	).join('') + (typeDependences.length ? '\n' : '')

}export interface ${type.name} {
${interfaceMembers.join('\n')}
}
`;

		return data;
	}

	generateIndexFor(types: SDLProcessedSchema) {
		let p = path.join(process.cwd(), 'tmp', 'types');

		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}

		let orderedTypeNames = Object.keys(types.objects).sort();

		let data =
`${
	orderedTypeNames.map(typeName =>
		`export * from './${camel2kebab(typeName)}.d';\n`
	).join('')
}`;

		writeFile(path.join(p, 'index.ts'), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}
}
