import vscode = require('vscode');
import fg = require('fast-glob');
import path = require('path');
import { ExtensionData } from './constants';
import { EntryItem } from 'fast-glob/out/types/entries';

const excludeFromFileSearch: string[] = [
    '!**/node_modules'
];

export function getSoyFiles (): Thenable<string[][]> {
    let promises = [];

    vscode.workspace.workspaceFolders.forEach(wsFolder => {
        const globalSoyFilesPath = path.join(wsFolder.uri.fsPath, '**', '*.soy');

        promises.push(fg.async([globalSoyFilesPath, ...excludeFromFileSearch]));
    });

    return Promise.all(promises);
}

export function getSoyFile (filePath): Thenable<EntryItem[]> {
    return fg.async(filePath);
}

export function getChangeLogPath () {
    const extensionPath: string = vscode.extensions.getExtension(ExtensionData.ExtensionIdentifier).extensionPath;

    return path.join(extensionPath, 'CHANGELOG.md');
}
