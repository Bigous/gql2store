import pluralize from 'pluralize';
import path from 'node:path';
import { FileGenerator } from './FileGenerator';
import { GenConfig, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camel2snake, camelize } from './utils';
import { existsSync, mkdirSync, writeFile } from 'node:fs';

export class StoreGenerator extends FileGenerator {
	folder = path.join('store', 'modules');
	sufix = '.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): void {
		// return it since has no important exports
		if (!type.queries.length && !type.parentTypes.filter(t => t.type.queries.length).length && !type.mutations.length) {
			return;
		}

		super.generateFileFor(type, types, config);
	}

	getData(type: SDLObjectType, types: SDLProcessedSchema) {
		const nameCamel = camelize(type.name);
		const nameKebab = camel2kebab(camelize(type.name));
		const typeNameSchema = camel2snake(camelize(type.name + 'Schema')).toUpperCase();

		const mutationNames = type.mutations.map(e => e.gqlMutationName);

		const typePluralName = pluralize(nameCamel);

		const fetchTypePlural = camelize('fetch ' + typePluralName);
		const wipeTypePlural = camelize('wipe ' + typePluralName);

		let str =
`import { normalize } from 'normalizr';
import _ from 'lodash';

import dao from '@/daos/${nameKebab}.dao';
import { ${typeNameSchema} } from '@/schema/${nameKebab}.schema';
`;

		str += type.parentTypes.map(parent => {
			if (parent.type.queries.length === 0) return '';

			const parentNameSchema = camel2snake(camelize(parent.type.name + 'Schema')).toUpperCase();
			const parentNameKebab = camel2kebab(camelize(parent.type.name));

			return `\nimport { ${parentNameSchema} } from '@/schema/${parentNameKebab}.schema';`;
		}).join('');

		str += `
import bcjGraphMerge from '@/utils/bcj-graph-merge';
import errorHandler from '@/utils/error-handler';
import enums from '@/enum/enum';

import * as types from '../mutations';

const initialState = {
	${typePluralName}: {},
	ids: [],
};

const actions = {
`;

		// make fetch if has actions
		if (type.queries.length || type.parentTypes.some(t => t.type.queries.length) || type.mutations.length) {
			str += `
	${fetchTypePlural}({ commit, dispatch }, { entities, args }) {
		if (entities.${nameCamel}) delete entities.${nameCamel}.undefined;

		const ids = Object.keys(entities.${nameCamel} || {});

		if (args && args.wipe) {
			dispatch('${wipeTypePlural}', { ids, soft: true });
		}
${
		type.children
			// in recursive entities, avoid definition loop
			.filter(child => child.typeName !== type.name)
			.map(child => {
				const childNameCamel = camelize(child.typeName);
				const fetchChildPlural = camelize('fetch ' + pluralize(child.typeName));

				return `
		if (entities.${childNameCamel}) dispatch('${fetchChildPlural}', { entities });`;
			}).join('') + (type.children.length > 0 ? '\n' : '')
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
`;
		}

		str += `\n\t// Queries\n`;

		str += type.queries.map(query => {
			const funcName = camelize('Get ' + query.gqlQueryName);

			return `
	${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, [${typeNameSchema}]))
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities, args }))
			.catch(errorHandler);
	},
`;
		}).join('');

		str += type.parentTypes.map(parent => {
			// Se o parent não tem query, não precisamos gerar o método.
			if (parent.type.queries.length === 0) return '';

			const getparentPlural = camelize('Get ' + parent.type.name + ' ' + pluralize(type.name));

			return `
	${getparentPlural}({ dispatch }, args) {
		return dao.${getparentPlural}(args)
			.then(res => normalize(res, [${parent.type.name.toUpperCase()}_SCHEMA]))
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities, args }))
			.catch(errorHandler);
	},
`;
		}).join('');

		str += `\n\t// Mutations\n`;

		str += mutationNames.filter(n => !n.toUpperCase().startsWith('DEL')).map(e => {
			const funcName = camelize(e);
			return `
	${funcName}({ dispatch }, args) {
		return dao.${funcName}(args)
			.then(res => normalize(res, ${typeNameSchema})) // normalize
			.then(({ entities }) => dispatch('${fetchTypePlural}', { entities })) // fetch
			.catch(errorHandler);
	},
`;
		}).join('');

		str += mutationNames.filter(n => n.toUpperCase().startsWith('DEL')).map(e => {
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
		}).join('');

		str += `
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
`;

		if (type.queries.length || type.parentTypes.some(t => t.type.queries.length) || type.mutations.length) {
			str += `
	[types.FETCH_${typePluralName.toUpperCase()}](state, { entities, result }) {
		state.ids = _.union(state.ids, result);
		state.${typePluralName} = bcjGraphMerge(state.${typePluralName}, entities.${nameCamel});
	},
`;
		}

		if (type.mutations.filter(m => m.gqlMutationName.toUpperCase().startsWith('DEL')).length) {
			str += `
	[types.DELETE_${typePluralName.toUpperCase()}](state, ids) {
		state.ids = state.ids.filter(id => ids.indexOf(id) < 0);

		ids.forEach((id) => {
			delete state.${typePluralName}[id];
		});
	},
`;
		}

		str += `
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
		return str;
	}

	generateStoreMutationsFor(types: SDLProcessedSchema, config?: GenConfig) {
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
		const type = types.objects[typeName];
		const nameCamel = camelize(typeName);
		const typePluralName = pluralize(nameCamel);

		let str = '';

		if (type.queries.length || type.parentTypes.some(t => t.type.queries.length) || type.mutations.length) {
			str += `export const FETCH_${typePluralName.toUpperCase()} = '[${nameCamel}] fetch ${typePluralName}';\n`
		}

		if (type.mutations.filter(m => m.gqlMutationName.toUpperCase().startsWith('DEL')).length) {
			str += `export const DELETE_${typePluralName.toUpperCase()} = '[${nameCamel}] delete ${typePluralName}';\n`
		}

		return str ? `\n// ${typeName}\n${str}` : '';
	}).join('')
}`;

		writeFile(path.join(p, 'mutations.ts'), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}
}
