import { existsSync, mkdirSync, writeFile } from 'node:fs';
import path from 'node:path';
import { SDLGenerator, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camelize } from './utils';

export abstract class FileGenerator implements SDLGenerator {
	folder = '';
	sufix = '.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema): void {
		const folderPath = path.join(process.cwd(), 'tmp', this.folder);

		if (!existsSync(folderPath)) {
			console.log('Creating directory: ' + folderPath);
			mkdirSync(folderPath, { recursive: true });
		}

		const fileName = camel2kebab(camelize(type.name)) + this.sufix;
		const fileData = this.getData(type, types);

		writeFile(path.join(process.cwd(), 'tmp', this.folder, fileName), fileData, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}

	abstract getData(type: SDLObjectType, types: SDLProcessedSchema): string;

}