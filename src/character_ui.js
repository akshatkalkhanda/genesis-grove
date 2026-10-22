import { TRAIT_CATALOG, has_trait } from './character_traits.js';
import { DIET_CATALOG, diet_food_available } from './diets.js';

const $ = id => document.getElementById(id);
const title_case = text => text.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const trait_info = id => TRAIT_CATALOG.find(trait => trait.id === id
    || has_trait({ trait_ids: [id] }, trait.id));
const trait_name = id => trait_info(id)?.label || title_case(id);
const diet_info = unit => DIET_CATALOG.find(diet => diet.id === (unit.diet_id || 'omnivore'));
const selected_ids = unit => unit.trait_ids || [];
const PHASE_ONE_DIETS = new Set(['herbivore', 'carnivore', 'omnivore']);

export function bind_character_ui({ get_world, get_selection, on_change, notify }) {
    const dialog = $('character-dialog');
    let target = null, tab = 'traits', pending_diet = 'omnivore';
    const find_unit = (world, selection) => (selection.kind === 'person' ? world.people
        : selection.kind === 'animal' ? world.animals : []).find(unit => unit.id === selection.id && unit.health > 0);
    function valid_target() {
        const selection = get_selection();
        return target && target.world === get_world() && selection?.kind === target.kind
            && selection?.id === target.id && find_unit(target.world, target) === target.unit;
    }
    function close_stale() {
        if (!dialog.open || valid_target()) return false;
        dialog.close(); notify('The inspected creature changed. Open its own traits to edit it.');
        return true;
    }
    function availability(world, unit) {
        const kingdom = world.villages.find(site => site.id === unit.village_id && site.alive);
        return kingdom ? `${diet_food_available(kingdom, unit).toFixed(1)} compatible food in shared stores`
            : 'No shared kingdom stores';
    }
    function row(label, value) {
        const element = document.createElement('div'); element.className = 'entity-row';
        const key = document.createElement('span'); key.textContent = label;
        const text = document.createElement('b'); text.textContent = value;
        element.append(key, text); return element;
    }
    function profile(unit, kind, expanded = new Set()) {
        const section = document.createElement('section'); section.className = 'character-profile';
        section.setAttribute('aria-label', 'Individual traits, diet and needs');
        const heading = document.createElement('div'); heading.className = 'character-profile-heading';
        const label = document.createElement('strong'); label.textContent = `Individual traits · ${selected_ids(unit).length}/12`;
        const edit = document.createElement('button'); edit.dataset.action = 'edit-character';
        edit.textContent = 'Edit traits & diet'; edit.onclick = () => open(kind, unit.id);
        heading.append(label, edit); section.append(heading);
        const chips = document.createElement('div'); chips.className = 'character-chips';
        for (const id of selected_ids(unit)) {
            const chip = document.createElement('span'); chip.className = 'character-chip';
            chip.textContent = trait_name(id); chips.append(chip);
        }
        if (!chips.childElementCount) chips.textContent = 'No additional traits recorded.';
        section.append(chips);
        for (const id of selected_ids(unit)) {
            const description = trait_info(id)?.description;
            if (!description) continue;
            const text = document.createElement('p'); text.className = 'character-effect';
            text.textContent = `${trait_name(id)}: ${description}`; section.append(text);
        }
        const diet = diet_info(unit);
        section.append(row('Diet', diet?.label || 'Omnivore'));
        const food = document.createElement('p'); food.className = 'character-effect';
        food.textContent = `${diet?.description || ''} ${availability(get_world(), unit)}`.trim();
        section.append(food);
        for (const [label, value] of [['Hunger', Number.isFinite(unit.needs?.nutrition)
            ? 100 - unit.needs.nutrition : null], ['Energy', unit.needs?.energy]]) {
            if (!Number.isFinite(value)) continue;
            const bounded = Math.max(0, Math.min(100, value));
            const field = document.createElement('label'); field.className = 'character-need';
            const text = document.createElement('span'); text.textContent = `${label} · ${Math.round(bounded)}/100`;
            const meter = document.createElement('meter'); meter.min = 0; meter.max = 100; meter.value = bounded;
            meter.setAttribute('aria-label', label);
            meter.setAttribute('aria-valuetext', label === 'Hunger'
                ? `${Math.round(bounded)} out of 100; higher means hungrier`
                : `${Math.round(bounded)} out of 100 energy remaining`);
            if (label === 'Hunger') { meter.low = 25; meter.high = 65; meter.optimum = 0; }
            else { meter.low = 30; meter.high = 65; meter.optimum = 100; }
            field.append(text, meter); section.append(field);
        }
        if (unit.recent_events?.length) {
            const events = document.createElement('details'); events.dataset.detail = 'entity-events';
            events.className = 'character-events'; events.open = expanded.has('entity-events');
            const summary = document.createElement('summary'); summary.textContent = 'Recent individual events'; events.append(summary);
            for (const event of unit.recent_events.slice(-8).sort((a, b) => b.time - a.time)) {
                const text = document.createElement('p'); text.textContent = `Year ${Math.floor(event.time / get_world().year_length) + 1} · ${event.text}`;
                events.append(text);
            }
            section.append(events);
        }
        return section;
    }
    function render() {
        if (!target || close_stale()) return;
        const unit = target.unit;
        const focused_trait = document.activeElement?.dataset.traitAction;
        const scroll_top = dialog.querySelector('.character-catalog-scroll').scrollTop;
        $('character-target').textContent = `${unit.name} · #${unit.id}`;
        $('character-count').textContent = `${selected_ids(unit).length}/12 additional traits · Primary trait: ${unit.trait || 'Unknown'}`;
        for (const button of dialog.querySelectorAll('[data-character-tab]')) {
            button.setAttribute('aria-pressed', String(button.dataset.characterTab === tab));
        }
        $('character-trait-list').hidden = tab !== 'traits';
        $('character-diet-list').hidden = tab !== 'diet';
        $('character-apply-diet').hidden = tab !== 'diet';
        $('character-diet-current').hidden = tab !== 'diet';
        $('character-trait-list').replaceChildren();
        const group_order = [...new Set(TRAIT_CATALOG.map(trait => trait.group))];
        let group = null;
        for (const trait of [...TRAIT_CATALOG].sort((a, b) => group_order.indexOf(a.group) - group_order.indexOf(b.group))) {
            if (trait.group !== group) {
                group = trait.group;
                const heading = document.createElement('h3'); heading.textContent = title_case(group || 'Traits');
                $('character-trait-list').append(heading);
            }
            const item = document.createElement('article'); item.className = 'character-catalog-item';
            item.dataset.traitId = trait.id;
            const heading = document.createElement('div'); heading.className = 'character-item-heading';
            const name = document.createElement('strong'); name.textContent = trait.label;
            const enabled = has_trait(unit, trait.id);
            const button = document.createElement('button'); button.dataset.traitAction = trait.id;
            button.textContent = enabled ? 'Remove' : 'Grant'; button.setAttribute('aria-pressed', String(enabled));
            button.setAttribute('aria-label', `${enabled ? 'Remove' : 'Grant'} ${trait.label}`);
            button.disabled = !enabled && selected_ids(unit).length >= 12
                && !(trait.conflicts || []).some(id => has_trait(unit, id));
            button.onclick = () => change_trait(trait.id, !enabled);
            heading.append(name, button);
            const description = document.createElement('p'); description.textContent = trait.description;
            item.append(heading, description);
            if (trait.conflicts?.length) {
                const conflicts = document.createElement('small'); conflicts.textContent = `Conflicts: ${trait.conflicts.map(trait_name).join(', ')}`;
                item.append(conflicts);
            }
            $('character-trait-list').append(item);
        }
        $('character-diet-list').replaceChildren();
        for (const diet of DIET_CATALOG.filter(diet => PHASE_ONE_DIETS.has(diet.id))) {
            const label = document.createElement('label'); label.className = 'character-diet-option';
            const input = document.createElement('input'); input.type = 'radio'; input.name = 'character-diet';
            input.value = diet.id; input.checked = pending_diet === diet.id;
            input.onchange = () => { pending_diet = diet.id; };
            const text = document.createElement('span');
            const name = document.createElement('strong'); name.textContent = diet.label;
            const description = document.createElement('span'); description.textContent = diet.description;
            const sources = document.createElement('small'); sources.textContent = `Allowed sources: ${diet.sources.map(title_case).join(', ')}`;
            text.append(name, description, sources); label.append(input, text); $('character-diet-list').append(label);
        }
        $('character-diet-current').textContent = `Current diet: ${diet_info(unit)?.label || 'Omnivore'} · ${availability(target.world, unit)}`;
        dialog.querySelector('.character-catalog-scroll').scrollTop = scroll_top;
        if (focused_trait) dialog.querySelector(`[data-trait-action="${focused_trait}"]`)?.focus({ preventScroll: true });
    }
    function open(kind, id) {
        const world = get_world(), selection = get_selection();
        const unit = find_unit(world, { kind, id });
        if (!unit || selection?.kind !== kind || selection?.id !== id) return;
        target = { world, kind, id, unit }; tab = 'traits'; pending_diet = unit.diet_id || 'omnivore';
        dialog.querySelector('.character-catalog-scroll').scrollTop = 0;
        $('character-status').textContent = '';
        render(); dialog.showModal();
    }
    function change_trait(id, enabled) {
        if (!valid_target()) { close_stale(); return; }
        const before = [...selected_ids(target.unit)];
        if (!target.world.set_character_trait(target.kind, target.id, id, enabled)) {
            $('character-status').textContent = 'Trait could not be changed. At most 12 additional traits are allowed.'; return;
        }
        const removed = before.filter(previous => !has_trait(target.unit, previous) && previous !== id);
        $('character-status').textContent = `${enabled ? 'Granted' : 'Removed'} ${trait_name(id)}.${removed.length ? ` Removed conflicting ${removed.map(trait_name).join(', ')}.` : ''}`;
        render(); on_change();
    }
    for (const button of dialog.querySelectorAll('[data-character-tab]')) button.onclick = () => {
        tab = button.dataset.characterTab; dialog.querySelector('.character-catalog-scroll').scrollTop = 0; render();
    };
    $('character-apply-diet').onclick = () => {
        if (!valid_target()) { close_stale(); return; }
        if (!target.world.set_diet(target.kind, target.id, pending_diet)) {
            $('character-status').textContent = 'Diet could not be changed.'; return;
        }
        $('character-status').textContent = `Diet set to ${diet_info(target.unit)?.label || pending_diet}.`;
        render(); on_change();
    };
    dialog.addEventListener('close', () => {
        const restore_focus = valid_target(); target = null;
        if (restore_focus) document.querySelector('#entity-card [data-action="edit-character"]')?.focus({ preventScroll: true });
    });
    return { profile, refresh: close_stale, close: () => { if (dialog.open) dialog.close(); } };
}
