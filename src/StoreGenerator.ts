import pluralize from 'pluralize';
import path from 'node:path';
import { FileGenerator } from './FileGenerator';
import { SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camel2snake, camelize } from './utils';
import { existsSync, mkdirSync, writeFile } from 'node:fs';

export class StoreGenerator extends FileGenerator {
	folder = path.join('store', 'modules');
	sufix = '.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema) {
		const nameCamel = camelize(type.name);
		const nameKebab = camel2kebab(camelize(type.name));
		const typeNameSchema = camel2snake(camelize(type.name + 'Schema')).toUpperCase();

		const mutationNames = type.mutations.map(e => e.gqlMutationName);

		const typePluralName = pluralize(nameCamel);

		const fetchTypePlural = camelize('fetch ' + typePluralName);
		const wipeTypePlural = camelize('wipe ' + typePluralName);

		const data =
`import { normalize } from 'normalizr';
import _ from 'lodash';

import dao from '@/daos/${nameKebab}.dao';
import { ${typeNameSchema} } from '@/schema/${nameKebab}.schema';
${
	type.dependantTypes.map(dep => {
		if (dep.type.queries.length === 0) return '';

		const depNameSchema = camel2snake(camelize(dep.type.name + 'Schema')).toUpperCase();
		const depNameKebab = camel2kebab(camelize(dep.type.name));

		return `\nimport { ${depNameSchema} } from '@/schema/${depNameKebab}.schema';`;
	}).join('')
}

import bcjGraphMerge from '@/utils/bcj-graph-merge';
import errorHandler from '@/utils/error-handler';
import enums from '@/enum/enum';

import * as types from '../mutations';

const initialState = {
	${typePluralName}: {},
	ids: [],
};

const actions = {

	${fetchTypePlural}({ commit, dispatch }, { entities, args }) {
		if (entities.${nameCamel}) delete entities.${nameCamel}.undefined;

		const ids = Object.keys(entities.${nameCamel} || {});

		if (args && args.wipe) {
			dispatch('${wipeTypePlural}', { ids, soft: true });
		}
${
	type.dependencies
		// in recursive entities, avoid definition loop
		.filter(dep => dep.typeName !== type.name)
		.map(dep => {
			const depNameCamel = camelize(dep.typeName);
			const fetchDepPlural = camelize('fetch ' + pluralize(dep.typeName));

			return `
		if (entities.${depNameCamel}) dispatch('${fetchDepPlural}', { entities });`;
		}).join('') + (type.dependencies.length > 0 ? '\n' : '')
}
		// fetch ${typePluralName}
		commit(types.FETCH_${typePluralName.toUpperCase()}, { entities, result: ids });

		// fetch list data
		dispatch('checkAsyncListArgs', { idEntity: enums.EntityIds.${type.name}, args, ids });

		// return ${typePluralName}
		return ids.map(id => entities.${nameCamel}[id]);
	},

	${wipeTypePlural}: ({ commit, dispatch }, { soft, ids }) => {
		commit(types.DELETE_${typePluralName.toUpperCase()}, ids);

		if (!soft) {
			dispatch('removeFromAsyncLists', { idEntity: enums.EntityIds.${type.name}, ids });
		}
	},

	// Queries
${
	type.queries.map(query => {
		const funcName = camelize('Get ' + query.gqlQueryName);

		return `
	${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, [${typeNameSchema}]))
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities, args }))
			.catch(errorHandler);
	},
`;
	}).join('')
}${
	type.dependantTypes.map(dep => {
		// Se o dependente não tem query, não precisamos gerar o método.
		if (dep.type.queries.length === 0) return '';

		const getDepPlural = camelize('Get ' + dep.type.name + ' ' + pluralize(type.name));

		return `
	${getDepPlural}({ dispatch }, args) {
		return dao.${getDepPlural}(args)
			.then(res => normalize(res, [${dep.type.name.toUpperCase()}_SCHEMA]))
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities, args }))
			.catch(errorHandler);
	},
`;
	}).join('')
}
	// Mutations
${
	mutationNames.filter(n => !n.toUpperCase().startsWith('DEL')).map(e => {
		const funcName = camelize(e);
		return `
	${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, ${typeNameSchema})) // normalize
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities })) // fetch
			.catch(errorHandler);
	},
`;
	}).join('')
}${
	mutationNames.filter(n => n.toUpperCase().startsWith('DEL')).map(e => {
		const funcName = camelize(e);
		return `
	${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then((res) => {
				// remove from store
				dispatch('${camelize('wipe ' + typePluralName)}', { ids: [res.${camelize('id ' + type.name)}] });
				return res;
			})
			.catch(errorHandler);
	},
`;
	}).join('')
}
};

// getters always use the state from the store.

const getters = {

	${camelize('get ' + typePluralName)}: state => ids => ids.map(id => state.${typePluralName}[id]),

	${typePluralName}: (state, rootGetters) => rootGetters.${camelize('get ' + typePluralName)}(state.ids),

	${camelize('get ' + type.name)}ById: (state, rootGetters) =>
		${type.id} =>
			rootGetters.${typePluralName}.find(v => v.${type.id} === ${type.id}),

};

const mutations = {

	[types.FETCH_${typePluralName.toUpperCase()}](state, { entities, result }) {
		state.ids = _.union(state.ids, result);
		state.${typePluralName} = bcjGraphMerge(state.${typePluralName}, entities.${nameCamel});
	},

	[types.DELETE_${typePluralName.toUpperCase()}](state, ids) {
		state.ids = state.ids.filter(id => ids.indexOf(id) < 0);

		ids.forEach((id) => {
			delete state.${typePluralName}[id];
		});
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
		const p = path.join(process.cwd(), 'tmp', 'store');

		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}

		const orderedTypeNames = Object.keys(types.objects).sort();

		const data =
`// async list
export const FETCH_ASYNC_LIST = '[asyncList] fetch async list';
export const FLAG_ASYNC_LISTS = '[asyncList] flag async lists';
export const RELOAD_ASYNC_LISTS = '[asyncList] reload async lists';
export const REMOVE_FROM_ASYNC_LISTS = '[asyncList] remove from async lists';

// auth
export const SET_TOKEN = '[auth] set token';
export const LOGOUT = '[auth] logout';

// wipes
export const WIPE_REPORT_STORE = '[global] wipe report store';
export const WIPE_STORE = '[global] wipe store';

// ---------- ENTITIES-CUSTOM ------------

// Admin
export const FETCH_ME = '[me] fetch me';

// ------------- ENTITIES ----------------
${
	orderedTypeNames.map(typeName => {
		const nameCamel = camelize(typeName);
		const typePluralName = pluralize(nameCamel);

		return `
// ${typeName}
export const FETCH_${typePluralName.toUpperCase()} = '[${nameCamel}] fetch ${typePluralName}';
export const DELETE_${typePluralName.toUpperCase()} = '[${nameCamel}] delete ${typePluralName}';
`;
	}).join('')
}`;

		writeFile(path.join(p, 'mutations.ts'), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}
}
