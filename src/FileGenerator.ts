import { existsSync, mkdirSync, writeFile } from "node:fs";
import path from "node:path";
import { SDLGenerator, SDLObjectType, SDLProcessedSchema } from "./types/definitions";
import { camel2kebab, camelize } from "./utils";

export abstract class FileGenerator implements SDLGenerator {
	folder: string = '';
	sufix: string = '.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema): void {
		let name = type.name;
		let p = path.join(process.cwd(), 'tmp', this.folder);
		if (!existsSync(p)) {
			console.log('Creating directory: ' + p);
			mkdirSync(p, { recursive: true });
		}
		let data = this.getData(type, types);
		writeFile(path.join(process.cwd(), 'tmp', this.folder, camel2kebab(camelize(name)) + this.sufix), data, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}

	abstract getData(type: SDLObjectType, types: SDLProcessedSchema): string;

}