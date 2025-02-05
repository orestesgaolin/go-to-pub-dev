// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	// Register a link provider for both Dart files and pubspec.yaml
	const linkProvider = vscode.languages.registerDocumentLinkProvider(
		[{ scheme: 'file', pattern: '**/*.dart' }, { scheme: 'file', pattern: '**/pubspec.yaml' }],
		new PubDevLinkProvider()
	);

	context.subscriptions.push(linkProvider);
}

class PubDevLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const text = document.getText();

		if (document.fileName.endsWith('.dart')) {
			// Handle Dart files - look for package imports
			const importRegex = /import\s+'package:([^\/]+)\/[^']+'\s*;/g;
			let match;

			while ((match = importRegex.exec(text))) {
				const packageName = match[1];
				const startPos = document.positionAt(match.index + match[0].indexOf(packageName));
				// Set end position to the semicolon
				const endPos = document.positionAt(match.index + match[0].length - 2);

				const link = new vscode.DocumentLink(
					new vscode.Range(startPos, endPos),
					vscode.Uri.parse(`https://pub.dev/packages/${packageName}`)
				);
				links.push(link);
			}
		} else if (document.fileName.endsWith('pubspec.yaml')) {
			// Handle pubspec.yaml files
			const lines = text.split('\n');
			let inDependencies = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				// Check if we're in the dependencies or dev_dependencies section
				if (line.match(/^(dependencies|dev_dependencies):/)) {
					inDependencies = true;
					continue;
				}

				// Exit if we're no longer in dependencies
				if (inDependencies && line.match(/^[a-zA-Z]/)) {
					if (!line.match(/^(dependencies|dev_dependencies):/)) {
						inDependencies = false;
					}
				}

				if (inDependencies) {
					const packageMatch = line.match(/^\s+([a-zA-Z0-9_]+):/);
					if (packageMatch) {
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
