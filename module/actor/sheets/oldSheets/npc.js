import ActorSheet5e from "./base.js";

/**
 * An Actor sheet for NPC type characters in the SW5E system.
 * @extends {ActorSheet5e}
 */
export default class ActorSheet5eNPC extends ActorSheet5e {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["sw5e", "sheet", "actor", "npc"],
            width: 600
        });
    }

    /* -------------------------------------------- */

    /** @override */
    static unsupportedItemTypes = new Set(["background", "class", "archetype"]);

    /* -------------------------------------------- */

    /**
     * Organize Owned Items for rendering the NPC sheet.
     * @param {object} data  Copy of the actor data being prepared for displayed. *Will be mutated.*
     * @private
     */
    _prepareItems(data) {
        // Categorize Items as Features and Powers
        const features = {
            weapons: {
                label: game.i18n.localize("SW5E.AttackPl"),
                items: [],
                hasActions: true,
                dataset: {"type": "weapon", "weapon-type": "natural"}
            },
            actions: {
                label: game.i18n.localize("SW5E.ActionPl"),
                items: [],
                hasActions: true,
                dataset: {"type": "feat", "activation.type": "action"}
            },
            passive: {label: game.i18n.localize("SW5E.Features"), items: [], dataset: {type: "feat"}},
            equipment: {label: game.i18n.localize("SW5E.Inventory"), items: [], dataset: {type: "loot"}}
        };

        // Start by classifying items into groups for rendering
        let [powers, other] = data.items.reduce(
            (arr, item) => {
                item.img = item.img || CONST.DEFAULT_TOKEN;
                item.isStack = Number.isNumeric(item.data.quantity) && item.data.quantity !== 1;
                item.hasUses = item.data.uses && item.data.uses.max > 0;
                item.isOnCooldown =
                    item.data.recharge && !!item.data.recharge.value && item.data.recharge.charged === false;
                item.isDepleted = item.isOnCooldown && item.data.uses.per && item.data.uses.value > 0;
                item.hasTarget = !!item.data.target && !["none", ""].includes(item.data.target.type);
                if (item.type === "power") arr[0].push(item);
                else arr[1].push(item);
                return arr;
            },
            [[], []]
        );

        // Apply item filters
        powers = this._filterItems(powers, this._filters.powerbook);
        other = this._filterItems(other, this._filters.features);

        // Organize Powerbook
        const powerbook = this._preparePowerbook(data, powers);

        // Organize Features
        for (let item of other) {
            if (item.type === "weapon") features.weapons.items.push(item);
            else if (item.type === "feat") {
                if (item.data.activation.type) features.actions.items.push(item);
                else features.passive.items.push(item);
            } else features.equipment.items.push(item);
        }

        // Assign and return
        data.features = Object.values(features);
        data.powerbook = powerbook;
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    getData(options) {
        const data = super.getData(options);

        // Challenge Rating
        const cr = parseFloat(data.data.details.cr || 0);
        const crLabels = {0: "0", 0.125: "1/8", 0.25: "1/4", 0.5: "1/2"};
        data.labels.cr = cr >= 1 ? String(cr) : crLabels[cr] || 1;

        // Creature Type
        data.labels.type = this.actor.labels.creatureType;

        // Armor Type
        data.labels.armorType = this.getArmorLabel();

        return data;
    }

    /* -------------------------------------------- */

    /**
     * Format NPC armor information into a localized string.
     * @returns {string}  Formatted armor label.
     */
    getArmorLabel() {
        const ac = this.actor.data.data.attributes.ac;
        const label = [];
        if (ac.calc === "default") label.push(this.actor.armor?.name || game.i18n.localize("SW5E.ArmorClassUnarmored"));
        else label.push(game.i18n.localize(CONFIG.SW5E.armorClasses[ac.calc].label));
        if (this.actor.shield) label.push(this.actor.shield.name);
        return label.filterJoin(", ");
    }

    /* -------------------------------------------- */
    /*  Object Updates                              */
    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {
        // Format NPC Challenge Rating
        const crs = {"1/8": 0.125, "1/4": 0.25, "1/2": 0.5};
        let crv = "data.details.cr";
        let cr = formData[crv];
        cr = crs[cr] || parseFloat(cr);
        if (cr) formData[crv] = cr < 1 ? cr : parseInt(cr);

        // Parent ActorSheet update steps
        return super._updateObject(event, formData);
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".health .rollable").click(this._onRollHPFormula.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle rolling NPC health values using the provided formula.
     * @param {Event} event  The original click event.
     * @private
     */
    _onRollHPFormula(event) {
        event.preventDefault();
        const formula = this.actor.data.data.attributes.hp.formula;
        if (!formula) return;
        const hp = new Roll(formula).roll({async: false}).total;
        AudioHelper.play({src: CONFIG.sounds.dice});
        this.actor.update({"data.attributes.hp.value": hp, "data.attributes.hp.max": hp});
    }
}
