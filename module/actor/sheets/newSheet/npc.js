import ActorSheet5e from "./base.js";

/**
 * An Actor sheet for NPC type characters in the SW5E system.
 * @extends {ActorSheet5e}
 */
export default class ActorSheet5eNPCNew extends ActorSheet5e {
    /** @override */
    get template() {
        if (!game.user.isGM && this.actor.limited) return "systems/sw5e/templates/actors/newActor/limited-sheet.html";
        return `systems/sw5e/templates/actors/newActor/npc-sheet.html`;
    }
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["sw5e", "sheet", "actor", "npc"],
            width: 800,
            tabs: [
                {
                    navSelector: ".root-tabs",
                    contentSelector: ".sheet-body",
                    initial: "attributes"
                }
            ]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    static unsupportedItemTypes = new Set([ "background", "class", "archetype", "starship", "starshipaction", "starshipfeature", "starshipmod" ]);

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
        let [forcepowers, techpowers, deployments, deploymentfeatures, ventures, other, ssfeats] = data.items.reduce(
            (arr, item) => {
                item.img = item.img || CONST.DEFAULT_TOKEN;
                item.isStack = Number.isNumeric(item.data.quantity) && item.data.quantity !== 1;
                item.hasUses = item.data.uses && item.data.uses.max > 0;
                item.isOnCooldown =
                    item.data.recharge && !!item.data.recharge.value && item.data.recharge.charged === false;
                item.isDepleted = item.isOnCooldown && item.data.uses.per && item.data.uses.value > 0;
                item.hasTarget = !!item.data.target && !["none", ""].includes(item.data.target.type);
                if (item.type === "power" && ["lgt", "drk", "uni"].includes(item.data.school)) arr[0].push(item);
                else if (item.type === "power" && ["tec"].includes(item.data.school)) arr[1].push(item);
                else if (item.type === "deployment") arr[2].push(item);
                else if (item.type === "deploymentfeature") arr[3].push(item);
                else if (item.type === "venture") arr[4].push(item);
                else arr[5].push(item);
                return arr;
            },
            [[], [], [], [], [], [], []]
        );

        // Apply item filters
        forcepowers = this._filterItems(forcepowers, this._filters.forcePowerbook);
        techpowers = this._filterItems(techpowers, this._filters.techPowerbook);
        ssfeats = this._filterItems(ssfeats, this._filters.ssfeatures);
        other = this._filterItems(other, this._filters.features);

        // Organize Powerbook
        const forcePowerbook = this._preparePowerbook(data, forcepowers, "uni");
        const techPowerbook = this._preparePowerbook(data, techpowers, "tec");

        // Organize Features
        for (let item of other) {
            if (item.type === "weapon") features.weapons.items.push(item);
            else if (item.type === "feat") {
                if (item.data.activation.type) features.actions.items.push(item);
                else features.passive.items.push(item);
            } else features.equipment.items.push(item);
        }
        // Organize Starship Features
        const ssfeatures = {
            deployments: {
                label: "SW5E.ItemTypeDeploymentPl",
                items: [],
                hasActions: false,
                dataset: {type: "deployment"},
                isDeployment: true
            },
            deploymentfeatures: {
                label: "SW5E.ItemTypeDeploymentfeaturePl",
                items: [],
                hasActions: true,
                dataset: {type: "deploymentfeature"},
                isDeploymentfeature: true
            },
            ventures: {
                label: "SW5E.ItemTypeVenturePl",
                items: [],
                hasActions: false,
                dataset: {type: "venture"},
                isVenture: true
            },
            active: {
                label: "SW5E.FeatureActive",
                items: [],
                hasActions: true,
                dataset: {"type": "feat", "activation.type": "action"}
            },
            passive: {label: "SW5E.FeaturePassive", items: [], hasActions: false, dataset: {type: "feat"}}
        };
        for (let ssf of ssfeats) {
            if (ssf.data.activation.type) ssfeatures.active.items.push(ssf);
            else ssfeatures.passive.items.push(ssf);
        }
        deployments.sort((a, b) => b.data.rank - a.data.rank);
        ssfeatures.deployments.items = deployments;
        ssfeatures.deploymentfeatures.items = deploymentfeatures;
        ssfeatures.ventures.items = ventures;

        // Assign and return
        data.features = Object.values(features);
        data.forcePowerbook = forcePowerbook;
        data.techPowerbook = techPowerbook;
        data.ssfeatures = Object.values(ssfeatures);
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

    /* -------------------------------------------- */

    /** @override */
    async _onDropItemCreate(itemData) {
        // Increment the number of deployment ranks of a character instead of creating a new item
        if (itemData.type === "deployment") {
            const rnk = this.actor.itemTypes.deployment.find((c) => c.name === itemData.name)?.data?.data?.rank ?? 999;
            if (rnk < 5) return rnk.update({"data.rank": rnk + 1});
        }

        // Create the owned item as normal
        return super._onDropItemCreate(itemData);
    }
}
