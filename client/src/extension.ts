'use strict';

import * as path from 'path';
import vscode = require('vscode');
import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import { SoyDefinitionProvider } from './definition-provider/soy-definition-provider';
import { SoyReferenceProvider } from './reference-provider/soy-reference-provider';
import { SoyHoverProvider } from './hover-provider/soy-hover-provider';
import { SoyDocumentSymbolProvider } from './document-symbol-provider/soy-document-symbol-provider';
import { getSoyFiles, getSoyFile, getChangeLogPath } from './files';
import { VersionManager } from './VersionManager';
import { Commands } from './constants';

const soyDefProvider = new SoyDefinitionProvider();
const soyRefProvider = new SoyReferenceProvider();
const soyHoverProvider = new SoyHoverProvider(soyDefProvider, soyRefProvider);
const soyDocumentSymbolProvider = new SoyDocumentSymbolProvider();
let client: LanguageClient;

const soyDocFilter: vscode.DocumentFilter = {
    language: 'soy',
    scheme: 'file'
};

function showNotification (message: string): void {
    vscode.window.showInformationMessage(message);
}

function initalizeProviders (startMessage: string, finishMessage: string): void {
    const prefix: string = 'Soy Extension:';

    showNotification(`${prefix} ${startMessage}`);
    getSoyFiles()
        .then(wsFolders => {
            soyDefProvider.parseWorkspaceFolders(wsFolders);
            soyRefProvider.parseWorkspaceFolders(wsFolders);
            showNotification(`${prefix} ${finishMessage}`);
        });
}

function showNewChanges(currentVersion: string, previousVersion: string) {
    console.log('previousVersion: ', previousVersion);
    console.log('currentVersion: ', currentVersion);

    if (!previousVersion) {
        console.log('first start, no prev version');
        // showExtensionChanges();
    } else if (previousVersion !== currentVersion) {
        console.log('update happened since last version');
        // showExtensionChanges();
    }
}
function showExtensionChanges () {
    const changeLogPath = getChangeLogPath();

    vscode.commands.executeCommand(Commands.ShowMarkDownPreview, changeLogPath);

    // vscode.workspace.openTextDocument(changeLogPath)
    //     .then(changelog => vscode.window.showTextDocument(changelog));
}

export function activate (context: ExtensionContext): void {
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };
    const versionManager: VersionManager = new VersionManager(context);

    showNewChanges(versionManager.getCurrentVersion(), versionManager.getSavedVersion());
    // versionManager.UpdateSavedVersion();

    context.subscriptions.push(vscode.languages.registerDefinitionProvider(soyDocFilter, soyDefProvider));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(soyDocFilter, soyRefProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(soyDocFilter, soyHoverProvider));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(soyDocFilter, soyDocumentSymbolProvider));
    context.subscriptions.push(vscode.commands.registerCommand(
        Commands.ReparseWorkSpace,
        () => initalizeProviders('Reparsing workspace...', 'Workspace parsed.')
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        Commands.ShowExtensionChanges,
        () => showExtensionChanges()
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        'soyfilesupport.clearSavedVersion',
        () => versionManager.clearSavedVersion()
    ));

    initalizeProviders('Starting up...', 'Started.');

    vscode.workspace.onDidSaveTextDocument(e => {
        getSoyFile(e.uri.fsPath)
            .then(file => {
                const filePath: string = <string>file[0];

                soyDefProvider.parseSingleFile(filePath);
                soyRefProvider.parseSingleFile(filePath);
            });
    }, null, context.subscriptions);

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'soy' }
        ],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    client = new LanguageClient(
        'soyLanguageServer',
        'Soy Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

export function deactivate (): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
