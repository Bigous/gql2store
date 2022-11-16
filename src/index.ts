import path from 'path';
import { argv } from 'process';
import { existsSync, readFileSync } from 'fs';
//import graphqlHTTP from 'express-graphql';

import { loadSchema } from './SDLLoader';
import { SchemaGenerator } from './SchemaGenerator';
import { DaoGenerator } from './DaoGenerator';
import { StoreGenerator } from './StoreGenerator';
import { TypesGenerator } from './TypesGenerator';
import { GenConfig } from './types/definitions';

path.basename(process.cwd());

const [, , sdlPath, configPath] = argv;

if (!sdlPath) {
	console.log('Invalid argument');
	console.log(argv);
	process.exit(1);
}

if (sdlPath == '--help') {
	console.log('Usage: node index.js <sdl file>');
	process.exit(0);
}

if (existsSync(sdlPath)) {
	console.log('Loading schema from file: ' + sdlPath);
	generateFilesFrom(sdlPath, configPath);
} else {
	console.log('Schema file not found: ' + sdlPath);
	process.exit(1);
}

/**
 * Process the SDL file and generate the store, dao and schema files.
 * @param {string} sdlPath
 */
function generateFilesFrom(sdlPath: string, configPath?: string) {
	console.log('Processing schema at: ' + sdlPath);

	const processedSchema = loadSchema(sdlPath);

	const configRaw = configPath && readFileSync(configPath, 'utf8');
	const config = configRaw ? JSON.parse(configRaw) as GenConfig : undefined;

	const types = Object.values(processedSchema.objects);
	const typeNames = Object.keys(processedSchema.objects);

	console.log('Generating schema files for types: ' + typeNames.join(', '));

	const storeGen = new StoreGenerator();
	const tsTypesGen = new TypesGenerator();
	const schemaGen = new SchemaGenerator();
	const daoGen = new DaoGenerator();

	types.forEach(type => {
		tsTypesGen.generateFileFor(type, processedSchema, config);
		schemaGen.generateFileFor(type, processedSchema, config);
	});

	// queries in dao needs schemas done

	types.forEach(type => {
		daoGen.generateFileFor(type, processedSchema, config);
		storeGen.generateFileFor(type, processedSchema, config);
	});

	storeGen.generateStoreMutationsFor(processedSchema, config);
	tsTypesGen.generateIndexFor(processedSchema, config);

	console.log('Done');
}
