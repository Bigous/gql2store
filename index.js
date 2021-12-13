import path from 'path';
import graphql from 'graphql';
import pluralize from 'pluralize';
import { argv } from 'process';
import { existsSync, readFileSync, writeFile, mkdirSync } from 'fs';
//import graphqlHTTP from 'express-graphql';

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
	const schema = graphql.buildSchema(readFileSync(argv[2], 'utf8'));
	console.log('Schema loaded');
	processSchema(schema);
} else {
	console.log('Schema file not found: ' + argv[2]);
	process.exit(1);
}

function camelize(str) {
	return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
		return index === 0 ? word.toLowerCase() : word.toUpperCase();
	}).replace(/\s+/g, '');
}

function camel2kebab(str) {
	return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function processSchema(schema) {
	console.log('Processing schema');
	let scalars = {};
	let objects = {};
	let interfaces = {};
	let unions = {};
	let enums = {};
	let inputs = {};
	let types = { scalars, objects, interfaces, unions, enums, inputs };
	Object.keys(schema._typeMap).forEach(element => {
		let type = schema._typeMap[element];
		if (!type.name.startsWith('__')) {
			if (type instanceof graphql.GraphQLObjectType) {
				if (type.name == 'PrivateQuery') {
					types.PrivateQuery = type;
				} else if (type.name == 'PrivateMutation') {
					types.PrivateMutation = type;
				} else {
					if (!type.exports)
						type.exports = [];

					if (!type.queries)
						type.queries = [];

					if (!type.mutations)
						type.mutations = [];

					objects[type.name] = type;
				}
			} else if (type instanceof graphql.GraphQLInterfaceType) {
				interfaces[type.name] = type;
			} else if (type instanceof graphql.GraphQLUnionType) {
				unions[type.name] = type;
			} else if (type instanceof graphql.GraphQLScalarType) {
				scalars[type.name] = type;
			} else if (type instanceof graphql.GraphQLEnumType) {
				enums[type.name] = type;
			} else if (type instanceof graphql.GraphQLInputObjectType) {
				inputs[type.name] = type;
			}
		}
	});

	let to = Object.keys(types.objects);

	generateDependeciyRelations(types.objects);
	generateCrossReference(types.objects);
	generateFragments(types.objects);

	console.log('Generating schema files for types: ' + to.join(', '));

	to.forEach(element => {
		let type = types.objects[element];
		generateSchemaFor(type, types);
		generateDaoFor(type);
		generateStoreFor(type, types);
	});
	generateStoreMutationsFor(types);

	console.log('Done');
}

function generateDependeciyRelations(objects) {
	let ok = Object.keys(objects);
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = type.getFields();
		type.dependencies = Object.keys(fields).filter(element => {
			let t = fields[element].type;
			return (t instanceof graphql.GraphQLObjectType) || (t instanceof graphql.GraphQLList);
		}).map(element => {
			return {
				fieldName: element,
				typeName: fields[element].type instanceof graphql.GraphQLObjectType ? fields[element].type.name : fields[element].type.ofType.name
			};
		});
	});
}

function generateCrossReference(objects) {
	let ok = Object.keys(objects);
	ok.forEach(typeName1 => {
		let type = objects[typeName1];
		type.dependantTypes = [];
		ok.forEach(typeName2 => {
			if (typeName1 !== typeName2) {
				let type2 = objects[typeName2];
				let depandant = type2.dependencies.find(i => i.typeName === typeName1);
				if (depandant) {
					type.dependantTypes.push({ type: type2, fieldName: depandant.fieldName });
				}
			}
		});
	});
}

function generateFragments(objects) {
	let ok = Object.keys(objects);
	ok.forEach(typeName => {
		let type = objects[typeName];
		let fields = Object.keys(type.getFields()).filter(fieldName => {
			let field = type.getFields()[fieldName];
			let typeField = undefined;
			if (field.type instanceof graphql.GraphQLObjectType) {
				typeField = objects[field.type];
			} else if(field.type instanceof graphql.GraphQLList) {
				typeField = objects[field.type.ofType];
			} else {
				return false;
			}
			return typeField && typeField.exports.indexOf(fieldName) === -1;
		});

	});
}

function generateSchemaFor(type, types) {
	let name = type.name;
	let p = path.join(process.cwd(), 'tmp', 'schema');
	if (!existsSync(p)) {
		console.log('Creating directory: ' + p);
		mkdirSync(p, { recursive: true });
	}
	let data = getHeaderSchemaStringFor(type) +
		getQueriesSchemaStringFor(type, types) +
		getMutationSchemaStringFor(type, types);
	writeFile(path.join(process.cwd(), 'tmp', 'schema', camel2kebab(camelize(name)) + '.schema.ts'), data, 'utf8', (err) => {
		if (err) {
			console.log('Error writing file: ' + err);
		}
	});
}


function getHeaderSchemaStringFor(type) {
	let fields = Object.keys(type.getFields());
	let name = type.name;
	let nameLower = name.toLowerCase();
	let nameUpper = name.toUpperCase();
	let nameCamel = camelize(name);
	let id = fields.find(element => {
		let e = element.toLowerCase();
		return e.startsWith('id') && e.endsWith(nameLower);
	});
	type.id = id;
	let dependencies = type.dependencies;
	let data = `
import { schema } from 'normalizr';
${dependencies.map(element => {
		return `import { ${element.typeName.toUpperCase()}_SCHEMA } from './${element.typeName.toLowerCase()}.schema';`;
	}).join('\n') + (dependencies.length > 0 ? '\n' : '')
		}
export const ${nameUpper}_SCHEMA = new schema.Entity('${nameCamel}', {${dependencies.map(element => {
			return `\n\t${element.fieldName}: [${element.typeName.toUpperCase()}_SCHEMA],`;
		}).join('') + (dependencies.length > 0 ? '\n' : '')
		}}, { idAttribute: '${id}' });

export const ${name}GQL = \`
  ${fields.filter(e => {
			// Here we filter out the fields that are object or list of objects. This happens because we wanna query the graphql for this fields only when we need them and not all the time.
			let t = type.getFields();
			return !(t[e].type instanceof graphql.GraphQLObjectType || t[e].type instanceof graphql.GraphQLList);
		}).join('\n  ')}
\`;
`;

	// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
	type.exports.push(`${name}GQL`);

	return data;
}

function getQueriesSchemaStringFor(type, types) {
	let queries = types.PrivateQuery;

	let data = '\n// Queries\n';

	// Fields no PrivateQuery são as queries disponíveis no graphql.
	let fields = queries.getFields();
	Object.keys(fields).forEach(eName => {
		let e = fields[eName];
		// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type) 
		// ou que retornam um array de objetos do tipo que estamos analisando (type).
		if ((e.type instanceof graphql.GraphQLObjectType && e.type.name == type.name) ||
			(e.type instanceof graphql.GraphQLList && e.type.ofType.name == type.name)) {
			let name = `Get${e.name}Args`;

			let args = e.args.map(a => `  ${a.name}: '${a.type.name}',\n`);
			data += `\nexport const ${name} = {\n${args.join('')}};\n`;

			// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
			type.exports.push(name);
			type.queries.push({ gqlQueryName: e.name, argsName: name });
		}

	});

	return data;
}

function getMutationSchemaStringFor(type, types) {
	let mutations = types.PrivateMutation;

	let data = '\n// Mutations\n';

	// Fields no PrivateMutation são as mutations disponíveis no graphql.
	let fields = mutations.getFields();
	Object.keys(fields).forEach(eName => {
		let e = fields[eName];
		// Pegamos apenas aquelas que retornam um objeto do tipo que estamos analisando (type)
		// ou que retornam um array de objetos do tipo que estamos analisando (type).
		if ((e.type instanceof graphql.GraphQLObjectType && e.type.name == type.name) ||
			(e.type instanceof graphql.GraphQLList && e.type.ofType.name == type.name)) {
			let name = `${e.name}Args`;
			let args = e.args.map(a => {
				let typeName = a.type.name;
				if (a.type instanceof graphql.GraphQLNonNull)
					typeName = `${a.type.ofType.name}!`;
				else if (a.type instanceof graphql.GraphQLList)
					typeName = `[${a.type.ofType.name}]`;
				return `  ${a.name}: '${typeName}',\n`;
			});
			data += `\nexport const ${name} = {\n${args.join('')}};\n`;

			// Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
			type.exports.push(name);
			type.mutations.push({ gqlMutationName: e.name, argsName: name });
		}
	});

	return data;
}

function generateDaoFor(type) {
	// Para o DAO, podemos pegar apenas os exports de cada type e gerar tudo... sem olhar o schema do Graphql, uma vez que os exports foram gerados baseados neles...
	let name = type.name;
	let nameLower = name.toLowerCase();
	let p = path.join(process.cwd(), 'tmp', 'daos');
	if (!existsSync(p)) {
		console.log('Creating directory: ' + p);
		mkdirSync(p, { recursive: true });
	}
	let gqlType = type.exports[0];
	let data = `import gql from 'graphql-tag';

import { privateClient } from '@/apollo';${type.dependantTypes.map(dep => {
		if (dep.type.queries.length > 0) {
			let importArgs = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));
			let importName = camel2kebab(camelize(dep.type.name));
			return `\nimport { ${importArgs} } from '@/schema/${importName}.schema';`;
		}
		return '';
	}).join('')}
import {
	${type.exports.join(',\n\t')},
} from '@/schema/${nameLower}.schema';
import { parseArgsGQL } from '@/utils/graphql';

export default {
${type.queries.map(e => {
		let funcName = camelize('Get ' + e.gqlQueryName);
		let gqlName = e.gqlQueryName;
		return `\t${funcName}(variables) {
		const qry = gql\`
			query ${funcName}(\${argsToString(${e.argsName})}) {
				${gqlName}(\${argsToParamsString(${e.argsName})}) {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.query({ query: qry, variables }).then(({ data }) => data.${gqlName});
	},\n\n`;
	}).join('')}
${type.dependantTypes.map(dep => {
		// Se o dependente não tem querie, não precisamos gerar o método.
		if (dep.type.queries.length === 0)
			return '';
		let dependentName = dep.type.name;
		let funcName = camelize('Get ' + dependentName + ' ' + pluralize(type.name));
		let gqlName = dep.type.queries[0].gqlQueryName;
		let tExp = type.exports.find(e => e.startsWith(`Get${pluralize(type.name)}`));
		let dExp = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));
		return `\t${funcName}(variables) {
		const { gqlArgs, gqlParams } = parseArgsGQL([${dExp}, ${tExp}]);
		const [${camelize(dep.type.name)}Params, ${camelize(type.name)}Params] = gqlParams;

		const qry = gql\`
			query ${funcName}(\${gqlArgs}) {
				${gqlName}(\${${camelize(dep.type.name)}Params}) {
					${dep.fieldName}(\${${camelize(type.name)}Params}) {
						\${${gqlType}}
					}
				}
			}
		\`;
		return privateClient.query({ query: qry, variables }).then(({ data }) => data.${gqlName});
	},\n\n`;
	}).join('')}
${type.mutations.map(e => {
		let funcName = camelize(e.gqlMutationName);
		let gqlName = e.gqlMutationName;
		return `\t${funcName}(variables) {
		const qry = gql\`
			mutation ${funcName}(\${argsToString(${e.argsName})}) {
				${gqlName}(\${argsToParamsString(${e.argsName})}) {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.mutate({ mutation: qry, variables }).then(({ data }) => data.${gqlName});
	},\n\n`;
	}).join('')}
};`;
	writeFile(path.join(p, camel2kebab(camelize(name)) + '.dao.ts'), data, 'utf8', (err) => {
		if (err) {
			console.log('Error writing file: ' + err);
		}
	});
}

function generateStoreFor(type, types) {
	let name = type.name;
	let nameLower = name.toLowerCase();
	let nameUpper = name.toUpperCase();
	let nameCamel = camelize(name);
	let p = path.join(process.cwd(), 'tmp', 'store', 'modules');
	if (!existsSync(p)) {
		console.log('Creating directory: ' + p);
		mkdirSync(p, { recursive: true });
	}

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
		let depNameUpper = depName.toUpperCase();
		let depNameCamel = camelize(depName);
		let depType = types.objects[depName];
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
	writeFile(path.join(p, camel2kebab(nameCamel) + '.ts'), data, 'utf8', (err) => {
		if (err) {
			console.log('Error writing file: ' + err);
		}
	});
}

function generateStoreMutationsFor(types) {
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
