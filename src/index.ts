import path from 'path';
import { argv } from 'process';
import { existsSync, readFileSync, writeFile, mkdirSync } from 'fs';
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

	const types = loadSchema(sdlFileName);

	const to = Object.keys(types.objects);

	console.log('Generating schema files for types: ' + to.join(', '));

	let sg = new StoreGenerator();
    let tg = new TypesGenerator();
	let generators = [new SchemaGenerator(), new DaoGenerator(), sg, tg];

	to.forEach(element => {
		let type = types.objects[element];
		generators.forEach(generator => {
			generator.generateFileFor(type, types);
		});
	});
	sg.generateStoreMutationsFor(types);
    tg.generateIndexFor(types);

	console.log('Done');
}
