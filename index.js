import path from 'path';
import graphql from 'graphql';
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

    Object.keys(types.objects).forEach(element => {
        let e = types.objects[element];
        generateSchemaFor(types.objects[element], types);
        generateDaoFor(types.objects[element], schema, types);
        generateStoreFor(types.objects[element], schema, types);
    });
}

function generateSchemaFor(type, types) {
    let name = type.name;
    let nameLower = name.toLowerCase();
    let p = path.join(process.cwd(), 'tmp', 'schema');
    if (!existsSync(p)) {
        console.log('Creating directory: ' + p);
        mkdirSync(p, { recursive: true });
    }
    let data = getHeaderSchemaStringFor(type) +
        getQueriesSchemaStringFor(type, types) +
        getMutationSchemaStringFor(type, types);
    writeFile(path.join(process.cwd(), 'tmp', 'schema', nameLower + '.schema.js'), data, 'utf8', (err) => {
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
    let id = fields.find(element => {
        let e = element.toLowerCase();
        return e.startsWith('id') && e.endsWith(nameLower);
    });
    let data = `
import { schema } from 'normalizr';

export const ${nameUpper}_SCHEMA = new schema.Entity('${nameLower}', {}, { idAttribute: '${id}' });

export const ${name}GQL = \`
  ${fields.join('\n  ')}
\`;
    `;

    // Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
    if (!type.exports)
        type.exports = [];

    type.exports.push(`${name}GQL`);

    if(!type.queries)
        type.queries = [];
    
    if(!type.mutations)
        type.mutations = [];

    return data;
}

function getQueriesSchemaStringFor(type, types) {
    let queries = types.PrivateQuery;

    let data = '\n// Queries\n\n';

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
            type.queries.push({gqlQueryName: e.name, argsName: name});
        }

    });

    return data;
}

function getMutationSchemaStringFor(type, types) {
    let mutations = types.PrivateMutation;

    let data = '\n// Mutations\n\n';

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
                else if(a.type instanceof graphql.GraphQLList)
                    typeName = `[${a.type.ofType.name}]`;
                return `  ${a.name}: '${typeName}',\n`;
            });
            data += `\nexport const ${name} = {\n${args.join('')}};\n`;

            // Para facilitar a geração do código de imports nos DAOs, os exports do schema são guardados no type em questão chamando de exports.
            type.exports.push(name);
            type.mutations.push({gqlMutationName: e.name, argsName: name});
        }
    });

    return data;
}

function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

function generateDaoFor(type, schema, types) {
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

import { privateClient } from '../apollo';
import {
    ${type.exports.join(',\n\t')},
} from '../schema/${nameLower}.schema';
import { argsToString, argsToParamsString } from '../utils/graphql';

export default {
${type.queries.map(e => {
        let funcName = camelize('Get'+e.gqlQueryName);
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
    writeFile(path.join(p, nameLower + '.dao.js'), data, 'utf8', (err) => {
        if (err) {
            console.log('Error writing file: ' + err);
        }
    });
}

function generateStoreFor(type, schema, types) {
    // TODO: Implementar o Store.
}
