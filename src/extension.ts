// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

let currentLinkProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
	// Initial registration
	registerLinkProvider(context);

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('goToPubDev')) {
				// Dispose old provider and register new one
				if (currentLinkProvider) {
					currentLinkProvider.dispose();
				}
				registerLinkProvider(context);
			}
		})
	);
}

function registerLinkProvider(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('goToPubDev');
	const enableDart = config.get<boolean>('enableDartFiles', true);
	const enablePubspec = config.get<boolean>('enablePubspecFile', true);

	const patterns: vscode.DocumentFilter[] = [];
	if (enableDart) {
		patterns.push({ scheme: 'file', pattern: '**/*.dart' });
	}
	if (enablePubspec) {
		patterns.push({ scheme: 'file', pattern: '**/pubspec.yaml' });
	}

	currentLinkProvider = vscode.languages.registerDocumentLinkProvider(
		patterns,
		new PubDevLinkProvider(enableDart, enablePubspec)
	);

	context.subscriptions.push(currentLinkProvider);
}

class PubDevLinkProvider implements vscode.DocumentLinkProvider {
	constructor(
		private enableDart: boolean,
		private enablePubspec: boolean
	) { }

	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const text = document.getText();

		if (this.enableDart && document.fileName.endsWith('.dart')) {
			// Handle Dart files - look for package imports 
			const importRegex = /import\s+'package:([^\/]+)\/([^\/\.'\s]+)/g;
			let match;

			while ((match = importRegex.exec(text))) {
				const packageName = match[1];
				const firstPathPart = match[2];

				// Skip if the package name doesn't match the first path part
				if (packageName !== firstPathPart) {
					continue;
				}

				const startPos = document.positionAt(match.index + match[0].indexOf(packageName));
				const endPos = document.positionAt(match.index + match[0].length);

				const link = new vscode.DocumentLink(
					new vscode.Range(startPos, endPos),
					vscode.Uri.parse(`https://pub.dev/packages/${packageName}`)
				);
				link.tooltip = "Open on pub.dev";
				links.push(link);
			}
		} else if (this.enablePubspec && document.fileName.endsWith('pubspec.yaml')) {
			// Handle pubspec.yaml files
			const lines = text.split('\n');
			let inDependencies = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				if (line.trim().startsWith('sdk:')) {
					continue;
				}

				// Check if we're in the dependencies or dev_dependencies section
				if (line.match(/^(dependencies|dev_dependencies|dependency_overrides):/)) {
					inDependencies = true;
					continue;
				}

				// Exit if we're no longer in dependencies
				if (inDependencies && line.match(/^[a-zA-Z]/)) {
					if (!line.match(/^(dependencies|dev_dependencies|dependency_overrides):/)) {
						inDependencies = false;
					}
				}

				if (inDependencies) {
					const packageMatch = line.match(/^\s+([a-zA-Z0-9_]+):/);
					if (packageMatch) {
						// Check next line for sdk: or path:
						const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
						if (nextLine.match(/^\s+(sdk|path):/)) {
							continue; // Skip this package
						}

						const packageName = packageMatch[1];
						const startIndex = line.indexOf(packageName);
						const startPos = new vscode.Position(i, startIndex);
						const endPos = new vscode.Position(i, startIndex + packageName.length);

						const link = new vscode.DocumentLink(
							new vscode.Range(startPos, endPos),
							vscode.Uri.parse(`https://pub.dev/packages/${packageName}`)
						);
						links.push(link);
					}
				}
			}
		}

		return links;
	}
}


// This method is called when your extension is deactivated
export function deactivate() { }
