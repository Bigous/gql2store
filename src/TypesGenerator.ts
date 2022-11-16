import path from 'node:path';
import { existsSync, mkdirSync, writeFile } from 'node:fs';

import { GraphQLEnumType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType } from 'graphql';

import { FileGenerator } from './FileGenerator';
import { GenConfig, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, getRootParentsConfigByType, getConfigByType } from './utils';

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
	folder = 'types';
	sufix = '.d.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): void {
		// this type will be declarated in root type
		if (getRootParentsConfigByType(type, config?.types).some(t => t.shareFileWithChildren)) {
			return;
		}

		super.generateFileFor(type, types, config);
	}

	createInterface(type: SDLObjectType, types: SDLProcessedSchema) {
		const typeFields = type.getFields();

		let useEnums = false;
		const children: SDLObjectType[] = [];

		const tsFields = Object.keys(typeFields).map(fieldName => {
			const field = typeFields[fieldName];

			const fieldType = field.type instanceof GraphQLNonNull && 'ofType' in field.type
				? field.type.ofType
				: field.type;

			let tsType = 'any';

			if (fieldType instanceof GraphQLList) {
				tsType = 'string[]'; // por definição é sempre string, mas poderia retornar o tipo correto ou string.
			} else if (fieldType instanceof GraphQLObjectType) {
				tsType = fieldType.name;
				children.push(types.objects[tsType]);
			} else if (fieldType instanceof GraphQLScalarType) {
				tsType = scalarMap[fieldType.name] || fieldType.name;
			} else if (fieldType instanceof GraphQLEnumType) {
				tsType = `valueof<typeof enums.${fieldType.name.replace('Enum', 'Types')}>`;
				useEnums = true;
			}

			return `\t${fieldName}${field.type instanceof GraphQLNonNull ? '' : '?'}: ${tsType};`;
		});

		const interfaceDeclaration = `export interface ${type.name} {\n${tsFields.join('\n')}\n}\n`

		return { interfaceDeclaration, useEnums, children };
	}

	createInterfaceRecursive(type: SDLObjectType, types: SDLProcessedSchema) {
		let useEnums = false;
		const { interfaceDeclaration, children, useEnums: tUseEnums } = this.createInterface(type, types);
		useEnums = tUseEnums;

		const childrenDeclr: string = children.length
			? children.map(c => {
				const { declarations, useEnums: cUseEnums } = this.createInterfaceRecursive(c, types);
				useEnums = cUseEnums || useEnums;

				return declarations;
			}).join('\n') + '\n'
			: '';

		return { declarations: `${childrenDeclr}${interfaceDeclaration}`, useEnums };
	}

	getData(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig) {
		const typeConfig = getConfigByType(type, config?.types);

		let useEnums = false;
		let strDeclarations = ''; // created to concat declarations only after imports

		if (typeConfig?.shareFileWithChildren) {
			const { declarations, useEnums: typeUseEnums } = this.createInterfaceRecursive(type, types);
			useEnums = typeUseEnums;
			strDeclarations += declarations;
		} else {
			const { interfaceDeclaration, children, useEnums: typeUseEnums } = this.createInterface(type, types);
			useEnums = typeUseEnums;

			if (children.length) {
				strDeclarations += children.map(child =>
					`import { ${child.name} } from './${camel2kebab(child.name)}.d';\n`
				).join('') + '\n';
			}

			strDeclarations += interfaceDeclaration;
		}


		let str = useEnums ?
`import enums from '@/enum/enum';
import { valueof } from './shared.d';

` : '';

		str += strDeclarations;

		return str;
	}

	generateIndexFor(types: SDLProcessedSchema, config?: GenConfig) {
		const p = path.join(process.cwd(), 'tmp', 'types');

		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}

		const orderedTypeNames = [
			...Object.keys(types.objects),
			...(config?.types?.inlcludeInIndex || []),
		].map(camel2kebab).sort(); // camel2kebab before sort to ensure it

		const data = `${
	orderedTypeNames.map(kebabName =>
		`export * from './${kebabName}.d';\n`
	).join('')
}`;

		writeFile(path.join(p, 'index.ts'), data, 'utf8', (err) => {
			if (err) console.log('Error writing file: ' + err);
		});
	}
}
