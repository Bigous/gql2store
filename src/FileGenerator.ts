import { existsSync, mkdirSync, writeFile } from 'node:fs';
import path from 'node:path';
import { GenConfig, SDLGenerator, SDLObjectType, SDLProcessedSchema } from './types/definitions';
import { camel2kebab, camelize } from './utils';

export abstract class FileGenerator implements SDLGenerator {
	folder = '';
	sufix = '.ts';

	generateFileFor(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): void {
		const folderPath = path.join(process.cwd(), 'tmp', this.folder);

		if (!existsSync(folderPath)) {
			console.log('Creating directory: ' + folderPath);
			mkdirSync(folderPath, { recursive: true });
		}

		const fileName = camel2kebab(camelize(type.name)) + this.sufix;
		const fileData = this.getData(type, types, config);

		writeFile(path.join(process.cwd(), 'tmp', this.folder, fileName), fileData, 'utf8', (err) => {
			if (err) {
				console.log('Error writing file: ' + err);
			}
		});
	}

	abstract getData(type: SDLObjectType, types: SDLProcessedSchema, config?: GenConfig): string;

}