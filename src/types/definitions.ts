import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType } from "graphql";

export interface SDLDependency {
    fieldName: string;
    typeName: string;
};

export interface SDLDependant {
    type: SDLObjectType;
    fieldName: string;
}

export interface SDLObjectType extends GraphQLObjectType {
    id?:string;
    dependencies: SDLDependency[];
    dependantTypes: SDLDependant[];
    exports: string[];
    queries: { gqlQueryName: string, argsName: string }[];
    mutations: { gqlMutationName: string, argsName: string }[];
};

export interface SDLScalarTypeMap { [name: string]: GraphQLScalarType };
export interface SDLObjectTypeMap { [name: string]: SDLObjectType };
export interface SDLInterfaceTypeMap { [name: string]: GraphQLInterfaceType };
export interface SDLUnionTypeMap { [name: string]: GraphQLUnionType };
export interface SDLEnumTypeMap { [name: string]: GraphQLEnumType };
export interface SDLInputTypeMap { [name: string]: GraphQLInputObjectType };

export interface SDLProcessedSchema {
    scalars: SDLScalarTypeMap;
    objects: SDLObjectTypeMap;
    interfaces: SDLInterfaceTypeMap;
    unions: SDLUnionTypeMap;
    enums: SDLEnumTypeMap;
    inputs: SDLInputTypeMap;
    PrivateQuery?: GraphQLObjectType;
    PrivateMutation?: GraphQLObjectType;
};

export interface SDLGenerator {
    generateFileFor(type: SDLObjectType, types: SDLProcessedSchema): void;
}