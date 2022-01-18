import pluralize from 'pluralize';
import { FileGenerator } from "./FileGenerator";
import { SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camel2kebab, camelize } from "./utils";

export class DaoGenerator extends FileGenerator {
	folder: string = 'daos';
	sufix: string = '.dao.ts';

	getData(type: SDLObjectType, types: SDLProcessedSchema): string {
		// Para o DAO, podemos pegar apenas os exports de cada type e gerar tudo... sem olhar o schema do Graphql, uma vez que os exports foram gerados baseados neles...
		let name = type.name;
		let nameLower = name.toLowerCase();
		let gqlType = type.exports[0];

		let data =
`import gql from 'graphql-tag';

import { privateClient } from '@/apollo';${

	type.dependantTypes.map(dep => {
		if (dep.type.queries.length === 0) return '';

		let importArgs = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));
		let importName = camel2kebab(camelize(dep.type.name));

		return `\nimport { ${importArgs} } from '@/schema/${importName}.schema';`;
	}).join('')

}
import {
	${type.exports.join(',\n\t')},
} from '@/schema/${nameLower}.schema';

import { parseArgsGQL } from '@/utils/graphql';

export default {
${

	type.queries.map(e => {
		let funcName = camelize('Get ' + e.gqlQueryName);
		let gqlName = e.gqlQueryName;

		return `
	${funcName}(variables) {
		const { gqlArgs, gqlParams } = parseArgsGQL([${e.argsName}]);
		const [${camelize(type.name)}Params] = gqlParams;

		const qry = gql\`
			query ${funcName}(\${gqlArgs}) {
				${gqlName}(\${${camelize(type.name)}Params}) {
					\${${gqlType}}
				}
			}
		\`;
		return privateClient.query({ query: qry, variables }).then(({ data }) => data.${gqlName});
	},
`;
	}).join('')

}${

	type.dependantTypes.map(dep => {
		// Se o dependente não tem querie, não precisamos gerar o método.
		if (dep.type.queries.length === 0) return '';

		let dependentName = dep.type.name;
		let funcName = camelize('Get ' + dependentName + ' ' + pluralize(type.name));
		let gqlName = dep.type.queries[0].gqlQueryName;
		let tExp = type.exports.find(e => e.startsWith(`Get${pluralize(type.name)}`));
		let dExp = dep.type.exports.find(e => e.startsWith(`Get${pluralize(dep.type.name)}`));

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
		let funcName = camelize(e.gqlMutationName);
		let gqlName = e.gqlMutationName;

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