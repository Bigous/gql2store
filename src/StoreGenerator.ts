import pluralize from 'pluralize';
import path from 'node:path'
import { FileGenerator } from "./FileGenerator";
import { SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camel2kebab, camelize } from "./utils";
import { existsSync, mkdirSync, writeFile } from 'node:fs';

export class StoreGenerator extends FileGenerator {
	folder: string = path.join('modules', 'store');
	sufix: string = '.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		let name = type.name;
		let nameLower = name.toLowerCase();
		let nameUpper = name.toUpperCase();
		let nameCamel = camelize(name);
	
		let queryNames = type.queries.map(e => e.gqlQueryName);
		let mutationNames = type.mutations.map(e => e.gqlMutationName);
	
		let typePluralName = pluralize(nameCamel);
	
		let data = `import { normalize } from 'normalizr';
import _ from 'lodash';

import dao from '@/daos/${nameLower}.dao';
import { ${nameUpper}_SCHEMA } from '@/schema/${nameLower}.schema';

import bcjGraphMerge from '@/utils/bcj-graph-merge';
import errorHandler from '@/utils/error-handler';
import enums from '@/enum/enum';

import * as types from '../mutations';

const initialState = {
	${typePluralName}: {},
	ids: [],
};

const actions = {

	${camelize('fetch ' + typePluralName)}({ commit, dispatch }, { entities, args }) {
		if (!entities.${nameCamel}) return null;

		const ids = Object.keys(entities.${nameCamel});\n${type.dependencies.map(e => {
		let depName = e.typeName;
		let depNameCamel = camelize(depName);
		let depTypePluralName = pluralize(depNameCamel);
		return `\n\t\tif(entities.${depNameCamel}) dispatch('${camelize('fetch ' + depTypePluralName)}', { entities });`;
	}).join('')}

		// fetch ${typePluralName}
		commit(types.FETCH_${typePluralName.toUpperCase()}, { entities, result: ids });

		// fetch list data
		dispatch('checkAsyncListArgs', { idEntity: enums.EntityIds.${name}, args, ids });

		// return ${typePluralName}
		return ids.map(id => entities.${nameCamel}[id]);
	},

	// Queries${queryNames.map(e => {
		let funcName = camelize('Get ' + e);
		return `\n\n\t${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, [${nameUpper}_SCHEMA]))
			.then(({ entities }) => dispatch('${camelize('fetch ' + typePluralName)}', { entities, args }))
			.catch(errorHandler);
	},`}).join('')}

	// Mutations${mutationNames.filter(n => {
			return !n.toUpperCase().startsWith('DEL');
		}).map(e => {
			let funcName = camelize(e);
			return `\n\n\t${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, ${nameUpper}_SCHEMA)) // normalize
			.then(({ entities }) => dispatch('${camelize('fetch ' + typePluralName)}', { entities })) // fetch
			.catch(errorHandler);
	},`
		}).join('')}${mutationNames.filter(n => {
			return n.toUpperCase().startsWith('DEL');
		}).map(e => {
			let funcName = camelize(e);
			return `\n\n\t${funcName}({ commit }, args) {
		return dao.${funcName}(args)
			.then(res => {
				// remove from store
				commit(types.DELETE_${nameUpper.toUpperCase()}, res);
				return res;
			})
			.catch(errorHandler);
	},`
		}).join('')}

};

// getters always use the state from the store.

const getters = {

	${camelize('get ' + typePluralName)}: state => ids => ids.map(id => state.${typePluralName}[id]),

	${typePluralName}: (state, rootGetters) => rootGetters.${camelize('get ' + typePluralName)}(state.ids),

	${camelize('get ' + name)}ById: (state, rootGetters) =>
		${type.id} =>
			rootGetters.${typePluralName}.find(v => v.${type.id} === ${type.id}),

};

const mutations = {

	[types.FETCH_${typePluralName.toUpperCase()}](state, { entities, result }) {
		state.ids = _.union(state.ids, result);
		state.${typePluralName} = bcjGraphMerge(state.${typePluralName}, entities.${nameCamel});
	},

	[types.DELETE_${nameUpper}](state, { ${type.id} }) {
		state.ids = state.ids.filter(id => id !== ${type.id});
		delete state.${typePluralName}[${type.id}];
	},

	[types.WIPE_STORE](state) {
		state.${typePluralName} = {};
		state.ids = [];
	},

};

export default {
	state: initialState,
	actions,
	getters,
	mutations,
};
`;
	return data;
	}
	
	generateStoreMutationsFor(types: SDLProcessedSchema) {
		let p = path.join(process.cwd(), 'tmp', 'store');
		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}
		let orderedTypeNames = Object.keys(types.objects).sort();
	
		let data = `// base
export const WIPE_STORE = '[base] wipe store';

${orderedTypeNames.map(e => {
		let nameUpper = e.toUpperCase();
		let nameCamel = camelize(e);
		let typePluralName = pluralize(nameCamel);

		return `// ${e}
export const FETCH_${nameUpper} = '[${nameCamel}] fetch ${nameCamel}';
export const FETCH_${typePluralName.toUpperCase()} = '[${typePluralName}] fetch ${typePluralName}';
export const DELETE_${nameUpper} = '[${nameCamel}] delete ${nameCamel}';\n\n`;
	}).join('\n')}\n`;
	
		writeFile(path.join(p, 'mutations.ts'), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}
}
