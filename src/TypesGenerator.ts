import path from 'node:path'
import { existsSync, mkdirSync, writeFile } from 'node:fs';

import { GraphQLEnumType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType } from 'graphql';

import { FileGenerator } from "./FileGenerator";
import { SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camel2kebab, camelize } from "./utils";

export class TypesGenerator extends FileGenerator {
	folder: string = 'types';
	sufix: string = '.d.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		let interdependentImportObjects: Array<string> = [];
		let enumsUsed = false;
		let interfaceMembers = Object.keys(type.getFields()).map(fieldName => {
			let fieldType = type.getFields()[fieldName].type;
			let fieldTypeName = '';
			let nullable = true;
			const scalarMap : {[key:string]:string} = {
				'JSON': 'any',
				'NullString': 'string',
				'UUID': 'string',
				//'DateTime': 'Date',
				'DateTime': 'string',
				'Boolean': 'boolean',
				'Int': 'number',
				'Float': 'number',
				'String': 'string',
				'ID': 'string',
				'ID!': 'string',
				'EmailAddress': 'string',
				'NullUUID': 'string',
			};
			if (fieldType instanceof GraphQLNonNull) {
				nullable = false;
				fieldType = (fieldType as GraphQLNonNull<any>).ofType;
			}
			if(fieldType instanceof GraphQLList) {
				fieldTypeName = 'string[]'; // por definição é sempre string, mas poderia retornar o tipo correto ou string.
			} else if(fieldType instanceof GraphQLObjectType) {
				fieldTypeName = fieldType.name;
				interdependentImportObjects.push(fieldTypeName);
			} else if(fieldType instanceof GraphQLScalarType) {
				fieldTypeName = scalarMap[fieldType.name] || fieldType.name;
			} else if(fieldType instanceof GraphQLEnumType) {
				fieldTypeName = `valueof<typeof enums.${fieldType.name.replace('Enum', 'Types')}>`;
				enumsUsed = true;
			}
		
			return `	${fieldName}${nullable ? '? : null | ' : ' : '}${fieldTypeName};`;
		});
		let data = `${enumsUsed ? "import enums from '@/enum/enum';\nimport { valueof } from './shared.d';\n" : ''}${interdependentImportObjects.map(typeName => {
	return `import { ${typeName} } from './${camel2kebab(typeName)}.d';\n`;
}).join('')}
export interface ${type.name} {
${interfaceMembers.join('\n')}
}`;
	return data;
	}
	
	generateIndexFor(types: SDLProcessedSchema) {
		let p = path.join(process.cwd(), 'tmp', 'types');
		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}
		let orderedTypeNames = Object.keys(types.objects).sort();
	
		let data = `${orderedTypeNames.map(typeName => {
			let name = camel2kebab(typeName);
			return `export * from './${name}.d';\n`;
		}).join('')}`;
	
		writeFile(path.join(p, 'index.ts'), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}
}
