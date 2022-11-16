import pluralize from 'pluralize';
import { FileGenerator } from './FileGenerator';
import { GenConfig, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camelize } from './utils';

export class DaoGenerator extends FileGenerator {
	folder = 'daos';
	sufix = '.dao.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): void {
		// return it since has no exports
		if (!type.queries.length && !type.parentTypes.filter(t => t.type.queries.length).length && !type.mutations.length) {
			return;
		}

		super.generateFileFor(type, types, config);
	}

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		// Para o DAO, podemos pegar apenas os exports de cada type e gerar tudo... sem olhar o schema do Graphql, uma vez que os exports foram gerados baseados neles...
		const name = type.name;
		const nameLower = name.toLowerCase();
		const gqlType = type.exports[0];

		let str =
`import gql from 'graphql-tag';

import { privateClient } from '@/apollo';${

	type.parentTypes.map(parent => {
		if (parent.type.queries.length === 0) return '';

		const importArgs = parent.type.exports.find(e => e.startsWith(`Get${pluralize(parent.type.name)}`));
		const importName = camel2kebab(camelize(parent.type.name));

		return importArgs ? `\nimport { ${importArgs} } from '@/schema/${importName}.schema';` : '';
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
	${funcName}(variables) {${query.argsName ? `
		const { gqlArgs, gqlParams } = parseArgsGQL([${query.argsName}]);
		const [${camelize(type.name)}Params] = gqlParams;
` : ''}
		const qry = gql\`
			query ${funcName}${query.argsName ? `(\${gqlArgs})` : ''} {
				${query.gqlQueryName}${query.argsName ? `(\${${camelize(type.name)}Params})`: ''} {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.query({ query: qry, variables }).then(({ data }) => data.${query.gqlQueryName});
	},
`;
	}).join('')

}${

	type.parentTypes.map(parent => {
		// TODO: apenas faz o get pelo parent se o id do mesmo estiver presente no type
		// Se o parent não tem query, não precisamos gerar o método.
		if (parent.type.queries.length === 0) return '';

		const ParentName = parent.type.name;
		const funcName = camelize('Get ' + ParentName + ' ' + pluralize(type.name));
		const gqlName = parent.type.queries[0].gqlQueryName;

		const ParentQueryArgs = parent.type.exports.find(e => e.startsWith(`Get${pluralize(parent.type.name)}`));
		const QueryArgs = type.exports.find(e => e.startsWith(`Get${pluralize(type.name)}`));

		const args = [
			{ args: ParentQueryArgs, params: `${camelize(parent.type.name)}Params` },
			{ args: QueryArgs, params: `${camelize(type.name)}Params` },
		].filter(v => v.args);

		return `
	${funcName}(variables) {${args.length ? `
		const { gqlArgs, gqlParams } = parseArgsGQL([${args.map(v => v.args).join(', ')}]);
		const [${args.map(v => v.params).join(', ')}] = gqlParams;
` : ''}
		const qry = gql\`
			query ${funcName}${args.length ? `(\${gqlArgs})` : ''} {
				${gqlName}${ParentQueryArgs ? `(\${${camelize(parent.type.name)}Params})` : ''} {
					${parent.fieldName}${QueryArgs ? `(\${${camelize(type.name)}Params})` : ''} {
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
	${funcName}(variables) {${e.argsName ? `
		const { gqlArgs, gqlParams } = parseArgsGQL([${e.argsName}]);
		const [${camelize(type.name)}Params] = gqlParams;
` : ''}
		const qry = gql\`
			mutation ${funcName}${e.argsName ? `(\${gqlArgs})` : ''} {
				${gqlName}${e.argsName ? `(\${${camelize(type.name)}Params})` : ''} {
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

		return str;
	}
}