import path from 'path';
import { argv } from 'process';
import { existsSync } from 'fs';
//import graphqlHTTP from 'express-graphql';

import { loadSchema } from './SDLLoader';
import { SchemaGenerator } from './SchemaGenerator';
import { DaoGenerator } from './DaoGenerator';
import { StoreGenerator } from './StoreGenerator';
import { TypesGenerator } from './TypesGenerator';

path.basename(process.cwd());

if (argv.length != 3) {
	console.log('Invalid argument');
	console.log(argv);
	process.exit(1);
}

if (argv[2] == '--help') {
	console.log('Usage: node index.js <sdl file>');
	process.exit(0);
}

if (existsSync(argv[2])) {
	console.log('Loading schema from file: ' + argv[2]);
	generateFilesFrom(argv[2]);
} else {
	console.log('Schema file not found: ' + argv[2]);
	process.exit(1);
}

/**
 * Process the SDL file and generate the store, dao and schema files.
 * @param {string} sdlFileName
 */
function generateFilesFrom(sdlFileName: string) {
	console.log('Processing schema at: ' + sdlFileName);

	const processedSchema = loadSchema(sdlFileName);

	const types = Object.values(processedSchema.objects);
	const typeNames = Object.keys(processedSchema.objects);

	console.log('Generating schema files for types: ' + typeNames.join(', '));

	const storeGen = new StoreGenerator();
	const tsTypesGen = new TypesGenerator();
	const generators = [new SchemaGenerator(), new DaoGenerator(), storeGen, tsTypesGen];

	types.forEach(type => {

		generators.forEach(generator => {
			generator.generateFileFor(type, processedSchema);
		});

	});

	storeGen.generateStoreMutationsFor(processedSchema);
	tsTypesGen.generateIndexFor(processedSchema);

	console.log('Done');
}
