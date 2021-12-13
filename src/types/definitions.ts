import graphql from "graphql";

export interface SDLDependency {
    fieldName: string;
    typeName: string;
};

export interface SDLDependant {
    type: SDLObjectType;
    fieldName: string;
}

export interface SDLObjectType extends graphql.GraphQLObjectType {
    id?:string;
    dependencies: SDLDependency[];
    dependantTypes: SDLDependant[];
    exports: string[];
    queries: { gqlQueryName: string, argsName: string }[];
    mutations: { gqlMutationName: string, argsName: string }[];
};

export interface SDLScalarTypeMap { [name: string]: graphql.GraphQLScalarType };
export interface SDLObjectTypeMap { [name: string]: SDLObjectType };
export interface SDLInterfaceTypeMap { [name: string]: graphql.GraphQLInterfaceType };
export interface SDLUnionTypeMap { [name: string]: graphql.GraphQLUnionType };
export interface SDLEnumTypeMap { [name: string]: graphql.GraphQLEnumType };
export interface SDLInputTypeMap { [name: string]: graphql.GraphQLInputObjectType };

export interface SDLProcessedSchema {
    scalars: SDLScalarTypeMap;
    objects: SDLObjectTypeMap;
    interfaces: SDLInterfaceTypeMap;
    unions: SDLUnionTypeMap;
    enums: SDLEnumTypeMap;
    inputs: SDLInputTypeMap;
    PrivateQuery?: graphql.GraphQLObjectType;
    PrivateMutation?: graphql.GraphQLObjectType;
};

export interface SDLGenerator {
    generateFileFor(type: SDLObjectType, types: SDLProcessedSchema): void;
}