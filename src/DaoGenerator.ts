import pluralize from 'pluralize';
import { FileGenerator } from './FileGenerator';
import { SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camelize } from './utils';

export class DaoGenerator extends FileGenerator {
	folder = 'daos';
	sufix = '.dao.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		// Para o DAO, podemos pegar apenas os exports de cada type e gerar tudo... sem olhar o schema do Graphql, uma vez que os exports foram gerados baseados neles...
		const name = type.name;
		const nameLower = name.toLowerCase();
		const gqlType = type.exports[0];

		const data =
`import gql from 'graphql-tag';

import { privateClient } from '@/apollo';${

	type.dependantTypes.map(dep => {
		if (dep.type.queries.length === 0) return '';

		const importArgs = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));
		const importName = camel2kebab(camelize(dep.type.name));

		return `\nimport { ${importArgs} } from '@/schema/${importName}.schema';`;
	}).join('')

}
import {
	${type.exports.join(',\n\t')},
} from '@/schema/${nameLower}.schema';

import { parseArgsGQL } from '@/utils/graphql';

export default {
${

	type.queries.map(query => {
		const funcName = camelize('Get ' + query.gqlQueryName);

		return `
	${funcName}(variables) {
		const { gqlArgs, gqlParams } = parseArgsGQL([${query.argsName}]);
		const [${camelize(type.name)}Params] = gqlParams;

		const qry = gql\`
			query ${funcName}(\${gqlArgs}) {
				${query.gqlQueryName}(\${${camelize(type.name)}Params}) {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.query({ query: qry, variables }).then(({ data }) => data.${query.gqlQueryName});
	},
`;
	}).join('')

}${

	type.dependantTypes.map(dep => {
		// Se o dependente não tem query, não precisamos gerar o método.
		if (dep.type.queries.length === 0) return '';

		const dependentName = dep.type.name;
		const funcName = camelize('Get ' + dependentName + ' ' + pluralize(type.name));
		const gqlName = dep.type.queries[0].gqlQueryName;
		const tExp = type.exports.find(e => e.startsWith(`Get${pluralize(type.name)}`));
		const dExp = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));

		return `
	${funcName}(variables) {
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
	},
`;
	}).join('')

}${

	type.mutations.map(e => {
		const funcName = camelize(e.gqlMutationName);
		const gqlName = e.gqlMutationName;

		return `
	${funcName}(variables) {
		const { gqlArgs, gqlParams } = parseArgsGQL([${e.argsName}]);
		const [${camelize(type.name)}Params] = gqlParams;

		const qry = gql\`
			mutation ${funcName}(\${gqlArgs}) {
				${gqlName}(\${${camelize(type.name)}Params}) {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.mutate({ mutation: qry, variables }).then(({ data }) => data.${gqlName});
	},
`;
	}).join('')

}
};
`;

		return data;
	}
}