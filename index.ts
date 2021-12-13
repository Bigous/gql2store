import path from 'path';
import { argv } from 'process';
import { existsSync, readFileSync, writeFile, mkdirSync } from 'fs';
//import graphqlHTTP from 'express-graphql';

import { loadSchema } from './src/SDLLoader';
import { SchemaGenerator } from './src/SchemaGenerator';
import { DaoGenerator } from './src/DaoGenerator';
import { StoreGenerator } from './src/StoreGenerator';

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

	const types = loadSchema(sdlFileName);

	const to = Object.keys(types.objects);

	console.log('Generating schema files for types: ' + to.join(', '));

	let sg = new StoreGenerator();
	let generators = [new SchemaGenerator(), new DaoGenerator(), sg];

	to.forEach(element => {
		let type = types.objects[element];
		generators.forEach(generator => {
			generator.generateFileFor(type, types);
		});
	});
	sg.generateStoreMutationsFor(types);

	console.log('Done');
}
