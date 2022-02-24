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