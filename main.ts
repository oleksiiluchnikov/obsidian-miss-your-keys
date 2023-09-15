import {
	App,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TAbstractFile,
	MarkdownView,
} from 'obsidian';

import {
	getAPI
} from 'obsidian-dataview';

interface MissYourKeysSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MissYourKeysSettings = {
	mySetting: 'default'

}

export type Field = {
	key: string; // key to search for
	regex: string; // regex to match the value
};

// SETTINGS

function setFieldsToSearch(): Field[] {
	const fields: Field[] = [
		{ key: 'uuid', regex: '([0-9a-f]{32})' },
		{ key: 'created', regex: '(\\d{4}-\\d{2}-\\d{2} \\w+)' },
		{ key: 'score', regex: '(\\d+)' },
		{ key: 'class', regex: '#class\/(.*)' },
		{ key: 'status', regex: '#status\/(.*)' },
		{ key: 'tags', regex: '(.*)' },
		{ key: 'client', regex: '#client\/(.*)' },
		{ key: 'shared', regex: '(true|false)' },
		{ key: 'eagle_folder', regex: '([A-Z0-9]{13})' },
	];
	return fields;
}

const PLUGIN_VIEW_TYPE = 'miss-your-keys-view';
const KEY_TAGS = 'tags';
const KEY_CLASS = 'class';

async function updateTag(tagItem: HTMLElement, tag: string): Promise<HTMLElement> {
	tagItem.classList.add('tag');
	tagItem.innerHTML = tag;
	return tagItem;
}

async function fetchClasses() {
    const api = getAPI(this.app);
    if (!api) {
        console.error('API is undefined');
        return;
    }

    const classQuery = `#${KEY_CLASS}`;
    const pages = api.pages(`${classQuery}`);
	if (!pages) return console.error('no pages found for query', classQuery);
    const uniqueClasses = getUniqueClasses(pages, classQuery);
    const uniqueParentClasses = getUniqueParentClasses(uniqueClasses);

    console.log(uniqueParentClasses);
    return uniqueParentClasses;
}

function getUniqueClasses(pages: Record<string, any>[], classQuery: string) {
    return [...pages]
        .filter(page => page.class && page.class !== 'undefined')
        .map(page => {
            const match = new RegExp(classQuery + '\/(.*)', 'i').exec(page.class);
            return match && match[1];
        })
        .filter(Boolean)
        .map(pageClass => pageClass.split('/'));
}

function getUniqueParentClasses(groupedClasses: string[][]) {
    let parentClasses: Set<string> = new Set();
    groupedClasses.forEach(pageClass => {
        if (pageClass) {
            let parentClass = pageClass[0].charAt(0).toUpperCase() + pageClass[0].slice(1);
            parentClasses.add(parentClass);
        }
    });

    return Array.from(parentClasses);
}


export default class MissYourKeys extends Plugin {
	settings: MissYourKeysSettings;

	async onload() {
		this.app.workspace.onLayoutReady(async () => {
			await refresh();
		});
		// Whenever a user interacts with the editor, update the stats
		this.registerDomEvent(document, 'pointerup', async () => {
			// await refresh();
			// await fetchClasses();
			return;
		});

		this.registerDomEvent(document, 'keydown', async (event: KeyboardEvent) => {
			await refresh();
			return;
		}, true);

		this.app.workspace.on('file-open', async (file: TFile) => {
			await refresh();
			return;
		});

		this.app.workspace.on('codemirror', async (cm: CodeMirror.Editor) => {
			await refresh();
			return;
		});

		// In your onload function
		// const resizeHandle = document.querySelector('.workspace-leaf-resize-handle');
		// if (!resizeHandle) return console.error('resizeHandle is undefined');
		//
		// const referenceEl = document.querySelector(".markdown-preview-sizer.markdown-preview-section");
		// if (!referenceEl) return console.error('referenceEl is undefined');
		// const targetEl = document.querySelector(`.${PLUGIN_VIEW_TYPE}`) as HTMLElement;
		// if (!targetEl) return console.error('targetEl is undefined');
		//
		// this.registerDomEvent(resizeHandle, 'pointermove', async (event: PointerEvent) => {
		// 	if (event.buttons === 1) {
		// 		if (referenceEl.clientWidth === 0) return;
		// 		if (!referenceEl) return console.error('referenceEl is undefined');
		// 		targetEl.style.width = `${referenceEl.clientWidth}px`;
		// 	}
		// 	return;
		// });
	}

	onunload() {

	}

	async onResize() {
		// fin.log('width', fromElement.clientWidth);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MissYourKeys;

	constructor(app: App, plugin: MissYourKeys) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

async function appendItem(text: string, container: HTMLElement) {
	const itemContainerEl = document.createElement('div');
	itemContainerEl.classList.add('row-item-container');
	container.appendChild(itemContainerEl);
	const item = itemContainerEl.createEl('span');
	item.classList.add('row-item');
	item.addEventListener('click', () => {
		console.log('clicked' + text);
	});
	item.addEventListener('pointerover', () => {
		item.classList.add('hover');
	});
	item.addEventListener('pointerout', () => {
		item.classList.remove('hover');
	});
	item.innerHTML = text;
	return item;
}

async function getCurrentView() {
	//* Get the current view
	const leaves = this.app.workspace.getLeavesOfType('markdown');
	let view;
	for (const leaf of leaves) {
		if (leaf.containerEl.classList.contains('mod-active')) {
			view = leaf.view
			break;
		}
	}
	if (!view) return;
	return view;
}

async function createMainContainer(view: MarkdownView) {
	//* Create the main container
	const referenceEl: HTMLElement = view.containerEl.querySelector(".markdown-preview-sizer.markdown-preview-section");
	let pluginContainerEl: HTMLElement = view.containerEl.querySelector(`.${PLUGIN_VIEW_TYPE}`);
	if (pluginContainerEl === null) {
		pluginContainerEl = view.containerEl.createEl('div', { cls: PLUGIN_VIEW_TYPE });
		view.containerEl.children[0].after(pluginContainerEl);
	}
	pluginContainerEl.empty();
	const relativeWidth = referenceEl.clientWidth;
	if (relativeWidth > 0) {
		pluginContainerEl.style.width = `${relativeWidth}px`;
	} else {
		pluginContainerEl.style.width = '100%';
	}
	return pluginContainerEl;
}


// MAIN
async function refresh() {

	const parentView = await getCurrentView();
	if (!parentView) return;
	const pluginContainerEl = await createMainContainer(parentView);

	//* Get the fields from the settings
	const fields: Field[] = setFieldsToSearch();

	const file: TFile = parentView.file;

	const api = getAPI(this.app);
	if (!api) return console.log('Dataview API not available');

	const page = api.page(file.path);
	if (!page) return console.log('Dataview page not available');

	// ---
	const metadataContainer = pluginContainerEl.createEl('div', { cls: 'metadata-container' });
	const tagsContainer = pluginContainerEl.createEl('div', { cls: 'row-container tags' });

	const keyColumnContainer = metadataContainer.createEl('div', { cls: 'column-container keys' });
	const valueColumnContainer = metadataContainer.createEl('div', { cls: 'column-container values' });
	const editorContainer = metadataContainer.createEl('div', { cls: 'column-container editor' });

	// ---

	const skipFields: Set<string> = new Set([]);
	const fieldRegExps = fields.map(field => new RegExp(field.regex, 'i'));

	for (const [i, field] of fields.entries()) {
		if (skipFields.has(field.key)) continue;

		const value = page[field.key] ?? page.frontmatter?.[field.key];
		const match = fieldRegExps[i].exec(value);

		let invalidClass = 'missing';
		let placeholder = 'missing';

		if (field.key === KEY_TAGS) {
			invalidClass = 'missing-tags';
			placeholder = 'missing tags';
		}

		if (!match) {
			const keyColumnPromise = appendItem(field.key, keyColumnContainer);
			const valueColumnPromise = appendItem(placeholder, valueColumnContainer);
			const keyColumn = await keyColumnPromise;
			keyColumn.classList.add(invalidClass);
			const valueColumn = await valueColumnPromise;
			valueColumn.classList.add(invalidClass);
			continue;
		}

		const validMatch = match[1] !== undefined;

		if (validMatch) {
			switch (field.key) {
				case KEY_TAGS:
					const tags = match[1].split(',').map((tag) => tag.trim());
					await Promise.all(tags.map((tag) => updateTag(tagsContainer.createEl('a'), tag)));
					break;
				default:
					const keyColumnPromise = appendItem(field.key, keyColumnContainer);
					const valueColumnPromise = appendItem(match[1], valueColumnContainer);
					await Promise.all([keyColumnPromise, valueColumnPromise]);
			}
		}
	}

}
