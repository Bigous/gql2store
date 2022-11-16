import { GraphQLField, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType } from 'graphql';
import { GenConfig, GenFileConfig, GenTypeConfig, SDLObjectType } from './types/definitions';

export function camelize(str: string): string {
	return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
		return index === 0 ? word.toLowerCase() : word.toUpperCase();
	}).replace(/\s+/g, '');
}

export function camel2kebab(str: string): string {
	return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function camel2snake(str: string): string {
	return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

export function objectFromField(type: GraphQLOutputType): GraphQLObjectType | null {
	if (type instanceof GraphQLObjectType) return type;
	if (type instanceof GraphQLNonNull) return objectFromField(type.ofType);
	if (type instanceof GraphQLList) return objectFromField(type.ofType);
	return null;
}

export function getConfigByType(type: SDLObjectType, fileConfig?: GenFileConfig) {
	const [, typeConfig] = fileConfig?.byType?.find(([typeName]) => typeName === type.name) || [];
	return typeConfig;
}

export function getRootParentsConfigByType(type: SDLObjectType, fileConfig?: GenFileConfig, typesToSkip: string[] = []): GenTypeConfig[] {
	return type.parentTypes
		.filter(t => typesToSkip.indexOf(t.type.name) < 0)
		.map(p => {
			const cfg = getConfigByType(p.type, fileConfig);

			return [
				...(cfg ? [cfg] : []),
				...(p.type.parentTypes.length ? getRootParentsConfigByType(p.type, fileConfig, [...typesToSkip, type.name]) : []),
			];
		}).flat();
}
