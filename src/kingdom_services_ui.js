import { kingdom_wellbeing } from './kingdom_wellbeing.js';

export function kingdom_services_panel(world, kingdom, on_policy, on_focus) {
    const m = kingdom_wellbeing(world, kingdom.id);
    const panel = document.createElement('section'); panel.className = 'kingdom-services';
    panel.setAttribute('aria-label', 'Kingdom wellbeing and public services');
    const headline = document.createElement('strong'); headline.className = 'wellbeing-headline';
    headline.textContent = m.happiness === null ? 'Happiness · no residents'
        : `Estimated happiness ${m.happiness}% · ${m.happy_percent}% satisfied`;
    panel.append(headline);
    const housing = document.createElement('span');
    housing.textContent = `Housing shortfall: ${m.homeless} people (${m.homeless_percent ?? 0}%) · ${m.beds} beds`;
    panel.append(housing);
    const detail = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = 'Living conditions & public services'; detail.append(summary);
    const row = (label, value) => {
        const line = document.createElement('div'); line.className = 'service-row';
        const name = document.createElement('b'); name.textContent = label;
        const text = document.createElement('span'); text.textContent = value; line.append(name, text); detail.append(line);
    };
    row('Food', `${Math.floor(m.food)} shared food · ${m.hungry} hungry residents`);
    row('Housing', `${m.housed}/${m.population} have housing capacity; five beds per house`);
    row('Water', `${m.wells} wells · ${m.drinking_water.stored.toFixed(1)} well rations · ${m.drinking_water.ponds} reachable freshwater ponds (${m.drinking_water.pond_stock.toFixed(1)} rations) · ${m.water_carried} carried · ${m.thirsty} thirsty / ${m.dehydrated} severely dehydrated. ${m.drinking_water.served}/${m.population} residents have a reachable well/pond from home; ${m.drinking_water.unserved} underserved. Access does not guarantee stock.`);
    row('Clothing', 'Clothing production and individual clothing needs are not modeled yet.');
    row('Clean air', 'Air quality and pollution exposure are not modeled yet.');
    row('Education', `${m.schools} schools · ${m.attending}/${m.school_age} school-age children attending now`);
    row('Healthcare', `${m.clinics} clinics · ${m.hospitals} hospitals · ${m.medical_staff} medical staff · ${m.sick} infected / ${m.injured} injured`);
    row('Safety', `${m.garrisons} military garrisons. Civilian police are not modeled yet.`);
    row('Detention', `${m.prisons} prisons · ${m.prisoners}/${m.prison_capacity} war-detention places occupied`);
    row('Justice', 'Advocates, trials and civilian courts are planned. War detention is not a criminal trial.');
    row('Taxes', 'No tax rate or tax collection is modeled. Town resources currently use shared stores.');
    const explanation = document.createElement('p'); explanation.className = 'service-explanation';
    explanation.textContent = 'Happiness is a needs-based estimate: food 30%, water 15%, housing 25%, health 20%, recent safety 10%. Satisfied means 65/100 or above. Housing shortfall estimates capacity; individual homes are not assigned.';
    detail.append(explanation); panel.append(detail);
    const funeral = document.createElement('details'), funeral_summary = document.createElement('summary');
    funeral_summary.textContent = 'Cemetery & funeral custom'; funeral.append(funeral_summary);
    const cemetery = world.cemeteries.find(c => c.kingdom_id === kingdom.id);
    const pending = world.remains.filter(r => r.kingdom_id === kingdom.id).length;
    const totals = document.createElement('p'); totals.className = 'funeral-totals';
    totals.textContent = `${cemetery?.buried || 0} buried · ${cemetery?.cremated || 0} cremated · ${pending} awaiting rest · ${cemetery?.unrecovered || 0} unrecovered`;
    funeral.append(totals);
    const choices = document.createElement('div'); choices.className = 'funeral-choices';
    for (const [method, label] of [['burial', 'Burial'], ['cremation', 'Cremation · 2 wood']]) {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.funeralMethod = method; button.textContent = label;
        button.setAttribute('aria-pressed', String((kingdom.funeral_method || 'burial') === method));
        button.onclick = () => {
            on_policy(method);
            for (const other of choices.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
        };
        choices.append(button);
    }
    funeral.append(choices);
    if (cemetery) {
        if (!world.walkable(cemetery.x, cemetery.y) || world.fire[world.index(cemetery.x, cemetery.y)] > 0) {
            const warning = document.createElement('p'); warning.textContent = 'Cemetery unsafe or submerged · funerals wait for a safe route.';
            funeral.append(warning);
        }
        const focus = document.createElement('button'); focus.type = 'button';
        focus.dataset.focusCemetery = String(kingdom.id); focus.textContent = 'Focus cemetery';
        focus.onclick = () => on_focus(cemetery); funeral.append(focus);
        const records = document.createElement('div'); records.className = 'memorial-records';
        for (const record of cemetery.records.slice(0, 6)) {
            const line = document.createElement('div');
            line.textContent = `${record.name} · age ${record.age_years} · ${record.method === 'lost' ? 'unrecovered' : record.method} · year ${record.year}`;
            records.append(line);
        }
        funeral.append(records);
    }
    panel.append(funeral); return panel;
}
