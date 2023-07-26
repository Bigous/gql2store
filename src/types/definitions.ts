import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType } from 'graphql';

export interface SDLChild {
	fieldName: string;
	typeName: string;
}

export interface SDLParent {
	fieldName: string;
	type: SDLObjectType;
}

export interface SDLObjectType extends GraphQLObjectType {
	id?:string;
	children: SDLChild[];
	parentTypes: SDLParent[];
	exports: string[];
	queries: { gqlQueryName: string, argsName?: string }[];
	mutations: { gqlMutationName: string, argsName?: string }[];
}

export interface SDLScalarTypeMap { [name: string]: GraphQLScalarType }
export interface SDLObjectTypeMap { [name: string]: SDLObjectType }
export interface SDLInterfaceTypeMap { [name: string]: GraphQLInterfaceType }
export interface SDLUnionTypeMap { [name: string]: GraphQLUnionType }
export interface SDLEnumTypeMap { [name: string]: GraphQLEnumType }
export interface SDLInputTypeMap { [name: string]: GraphQLInputObjectType }

export interface SDLProcessedSchema {
	scalars: SDLScalarTypeMap;
	objects: SDLObjectTypeMap;
	interfaces: SDLInterfaceTypeMap;
	unions: SDLUnionTypeMap;
	enums: SDLEnumTypeMap;
	inputs: SDLInputTypeMap;
	PrivateQuery?: GraphQLObjectType;
	PrivateMutation?: GraphQLObjectType;
}

export interface SDLGenerator {
	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema): void;
}

export interface GenTypeConfig {
	inlineChildren?: boolean;
	genDaoObject?: string[]; // functions that will have dao obj
	shareFileWithChildren?: boolean;
}

export interface GenFileConfig {
	byType?: [string, GenTypeConfig][];
	inlcludeInIndex?: string[];

	translationObject?: {
		fields?: string[];
	}
}

export interface GenConfig {
	queriesType: string;
	mutationsType: string;

	schemas?: GenFileConfig,
	types?: GenFileConfig,
}