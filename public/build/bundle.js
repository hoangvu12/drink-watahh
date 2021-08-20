
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.42.1' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var humanizeDuration = createCommonjsModule(function (module) {
    // HumanizeDuration.js - https://git.io/j0HgmQ

    /* global define, module */

    (function () {
      // This has to be defined separately because of a bug: we want to alias
      // `gr` and `el` for backwards-compatiblity. In a breaking change, we can
      // remove `gr` entirely.
      // See https://github.com/EvanHahn/HumanizeDuration.js/issues/143 for more.
      var greek = {
        y: function (c) {
          return c === 1 ? "χρόνος" : "χρόνια";
        },
        mo: function (c) {
          return c === 1 ? "μήνας" : "μήνες";
        },
        w: function (c) {
          return c === 1 ? "εβδομάδα" : "εβδομάδες";
        },
        d: function (c) {
          return c === 1 ? "μέρα" : "μέρες";
        },
        h: function (c) {
          return c === 1 ? "ώρα" : "ώρες";
        },
        m: function (c) {
          return c === 1 ? "λεπτό" : "λεπτά";
        },
        s: function (c) {
          return c === 1 ? "δευτερόλεπτο" : "δευτερόλεπτα";
        },
        ms: function (c) {
          return c === 1
            ? "χιλιοστό του δευτερολέπτου"
            : "χιλιοστά του δευτερολέπτου";
        },
        decimal: ","
      };

      var ARABIC_DIGITS = ["۰", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

      var LANGUAGES = {
        af: {
          y: "jaar",
          mo: function (c) {
            return "maand" + (c === 1 ? "" : "e");
          },
          w: function (c) {
            return c === 1 ? "week" : "weke";
          },
          d: function (c) {
            return c === 1 ? "dag" : "dae";
          },
          h: function (c) {
            return c === 1 ? "uur" : "ure";
          },
          m: function (c) {
            return c === 1 ? "minuut" : "minute";
          },
          s: function (c) {
            return "sekonde" + (c === 1 ? "" : "s");
          },
          ms: function (c) {
            return "millisekonde" + (c === 1 ? "" : "s");
          },
          decimal: ","
        },
        ar: {
          y: function (c) {
            return ["سنة", "سنتان", "سنوات"][getArabicForm(c)];
          },
          mo: function (c) {
            return ["شهر", "شهران", "أشهر"][getArabicForm(c)];
          },
          w: function (c) {
            return ["أسبوع", "أسبوعين", "أسابيع"][getArabicForm(c)];
          },
          d: function (c) {
            return ["يوم", "يومين", "أيام"][getArabicForm(c)];
          },
          h: function (c) {
            return ["ساعة", "ساعتين", "ساعات"][getArabicForm(c)];
          },
          m: function (c) {
            return ["دقيقة", "دقيقتان", "دقائق"][getArabicForm(c)];
          },
          s: function (c) {
            return ["ثانية", "ثانيتان", "ثواني"][getArabicForm(c)];
          },
          ms: function (c) {
            return ["جزء من الثانية", "جزآن من الثانية", "أجزاء من الثانية"][
              getArabicForm(c)
            ];
          },
          decimal: ",",
          delimiter: " و ",
          _formatCount: function (count, decimal) {
            var replacements = assign(ARABIC_DIGITS, { ".": decimal });
            var characters = count.toString().split("");
            for (var i = 0; i < characters.length; i++) {
              var character = characters[i];
              if (has(replacements, character)) {
                characters[i] = replacements[character];
              }
            }
            return characters.join("");
          }
        },
        bg: {
          y: function (c) {
            return ["години", "година", "години"][getSlavicForm(c)];
          },
          mo: function (c) {
            return ["месеца", "месец", "месеца"][getSlavicForm(c)];
          },
          w: function (c) {
            return ["седмици", "седмица", "седмици"][getSlavicForm(c)];
          },
          d: function (c) {
            return ["дни", "ден", "дни"][getSlavicForm(c)];
          },
          h: function (c) {
            return ["часа", "час", "часа"][getSlavicForm(c)];
          },
          m: function (c) {
            return ["минути", "минута", "минути"][getSlavicForm(c)];
          },
          s: function (c) {
            return ["секунди", "секунда", "секунди"][getSlavicForm(c)];
          },
          ms: function (c) {
            return ["милисекунди", "милисекунда", "милисекунди"][getSlavicForm(c)];
          },
          decimal: ","
        },
        bn: {
          y: "বছর",
          mo: "মাস",
          w: "সপ্তাহ",
          d: "দিন",
          h: "ঘন্টা",
          m: "মিনিট",
          s: "সেকেন্ড",
          ms: "মিলিসেকেন্ড"
        },
        ca: {
          y: function (c) {
            return "any" + (c === 1 ? "" : "s");
          },
          mo: function (c) {
            return "mes" + (c === 1 ? "" : "os");
          },
          w: function (c) {
            return "setman" + (c === 1 ? "a" : "es");
          },
          d: function (c) {
            return "di" + (c === 1 ? "a" : "es");
          },
          h: function (c) {
            return "hor" + (c === 1 ? "a" : "es");
          },
          m: function (c) {
            return "minut" + (c === 1 ? "" : "s");
          },
          s: function (c) {
            return "segon" + (c === 1 ? "" : "s");
          },
          ms: function (c) {
            return "milisegon" + (c === 1 ? "" : "s");
          },
          decimal: ","
        },
        cs: {
          y: function (c) {
            return ["rok", "roku", "roky", "let"][getCzechOrSlovakForm(c)];
          },
          mo: function (c) {
            return ["měsíc", "měsíce", "měsíce", "měsíců"][getCzechOrSlovakForm(c)];
          },
          w: function (c) {
            return ["týden", "týdne", "týdny", "týdnů"][getCzechOrSlovakForm(c)];
          },
          d: function (c) {
            return ["den", "dne", "dny", "dní"][getCzechOrSlovakForm(c)];
          },
          h: function (c) {
            return ["hodina", "hodiny", "hodiny", "hodin"][getCzechOrSlovakForm(c)];
          },
          m: function (c) {
            return ["minuta", "minuty", "minuty", "minut"][getCzechOrSlovakForm(c)];
          },
          s: function (c) {
            return ["sekunda", "sekundy", "sekundy", "sekund"][
              getCzechOrSlovakForm(c)
            ];
          },
          ms: function (c) {
            return ["milisekunda", "milisekundy", "milisekundy", "milisekund"][
              getCzechOrSlovakForm(c)
            ];
          },
          decimal: ","
        },
        cy: {
          y: "flwyddyn",
          mo: "mis",
          w: "wythnos",
          d: "diwrnod",
          h: "awr",
          m: "munud",
          s: "eiliad",
          ms: "milieiliad"
        },
        da: {
          y: "år",
          mo: function (c) {
            return "måned" + (c === 1 ? "" : "er");
          },
          w: function (c) {
            return "uge" + (c === 1 ? "" : "r");
          },
          d: function (c) {
            return "dag" + (c === 1 ? "" : "e");
          },
          h: function (c) {
            return "time" + (c === 1 ? "" : "r");
          },
          m: function (c) {
            return "minut" + (c === 1 ? "" : "ter");
          },
          s: function (c) {
            return "sekund" + (c === 1 ? "" : "er");
          },
          ms: function (c) {
            return "millisekund" + (c === 1 ? "" : "er");
          },
          decimal: ","
        },
        de: {
          y: function (c) {
            return "Jahr" + (c === 1 ? "" : "e");
          },
          mo: function (c) {
            return "Monat" + (c === 1 ? "" : "e");
          },
          w: function (c) {
            return "Woche" + (c === 1 ? "" : "n");
          },
          d: function (c) {
            return "Tag" + (c === 1 ? "" : "e");
          },
          h: function (c) {
            return "Stunde" + (c === 1 ? "" : "n");
          },
          m: function (c) {
            return "Minute" + (c === 1 ? "" : "n");
          },
          s: function (c) {
            return "Sekunde" + (c === 1 ? "" : "n");
          },
          ms: function (c) {
            return "Millisekunde" + (c === 1 ? "" : "n");
          },
          decimal: ","
        },
        el: greek,
        en: {
          y: function (c) {
            return "year" + (c === 1 ? "" : "s");
          },
          mo: function (c) {
            return "month" + (c === 1 ? "" : "s");
          },
          w: function (c) {
            return "week" + (c === 1 ? "" : "s");
          },
          d: function (c) {
            return "day" + (c === 1 ? "" : "s");
          },
          h: function (c) {
            return "hour" + (c === 1 ? "" : "s");
          },
          m: function (c) {
            return "minute" + (c === 1 ? "" : "s");
          },
          s: function (c) {
            return "second" + (c === 1 ? "" : "s");
          },
          ms: function (c) {
            return "millisecond" + (c === 1 ? "" : "s");
          },
          decimal: "."
        },
        eo: {
          y: function (c) {
            return "jaro" + (c === 1 ? "" : "j");
          },
          mo: function (c) {
            return "monato" + (c === 1 ? "" : "j");
          },
          w: function (c) {
            return "semajno" + (c === 1 ? "" : "j");
          },
          d: function (c) {
            return "tago" + (c === 1 ? "" : "j");
          },
          h: function (c) {
            return "horo" + (c === 1 ? "" : "j");
          },
          m: function (c) {
            return "minuto" + (c === 1 ? "" : "j");
          },
          s: function (c) {
            return "sekundo" + (c === 1 ? "" : "j");
          },
          ms: function (c) {
            return "milisekundo" + (c === 1 ? "" : "j");
          },
          decimal: ","
        },
        es: {
          y: function (c) {
            return "año" + (c === 1 ? "" : "s");
          },
          mo: function (c) {
            return "mes" + (c === 1 ? "" : "es");
          },
          w: function (c) {
            return "semana" + (c === 1 ? "" : "s");
          },
          d: function (c) {
            return "día" + (c === 1 ? "" : "s");
          },
          h: function (c) {
            return "hora" + (c === 1 ? "" : "s");
          },
          m: function (c) {
            return "minuto" + (c === 1 ? "" : "s");
          },
          s: function (c) {
            return "segundo" + (c === 1 ? "" : "s");
          },
          ms: function (c) {
            return "milisegundo" + (c === 1 ? "" : "s");
          },
          decimal: ","
        },
        et: {
          y: function (c) {
            return "aasta" + (c === 1 ? "" : "t");
          },
          mo: function (c) {
            return "kuu" + (c === 1 ? "" : "d");
          },
          w: function (c) {
            return "nädal" + (c === 1 ? "" : "at");
          },
          d: function (c) {
            return "päev" + (c === 1 ? "" : "a");
          },
          h: function (c) {
            return "tund" + (c === 1 ? "" : "i");
          },
          m: function (c) {
            return "minut" + (c === 1 ? "" : "it");
          },
          s: function (c) {
            return "sekund" + (c === 1 ? "" : "it");
          },
          ms: function (c) {
            return "millisekund" + (c === 1 ? "" : "it");
          },
          decimal: ","
        },
        eu: {
          y: "urte",
          mo: "hilabete",
          w: "aste",
          d: "egun",
          h: "ordu",
          m: "minutu",
          s: "segundo",
          ms: "milisegundo",
          decimal: ","
        },
        fa: {
          y: "سال",
          mo: "ماه",
          w: "هفته",
          d: "روز",
          h: "ساعت",
          m: "دقیقه",
          s: "ثانیه",
          ms: "میلی ثانیه",
          decimal: "."
        },
        fi: {
          y: function (c) {
            return c === 1 ? "vuosi" : "vuotta";
          },
          mo: function (c) {
            return c === 1 ? "kuukausi" : "kuukautta";
          },
          w: function (c) {
            return "viikko" + (c === 1 ? "" : "a");
          },
          d: function (c) {
            return "päivä" + (c === 1 ? "" : "ä");
          },
          h: function (c) {
            return "tunti" + (c === 1 ? "" : "a");
          },
          m: function (c) {
            return "minuutti" + (c === 1 ? "" : "a");
          },
          s: function (c) {
            return "sekunti" + (c === 1 ? "" : "a");
          },
          ms: function (c) {
            return "millisekunti" + (c === 1 ? "" : "a");
          },
          decimal: ","
        },
        fo: {
          y: "ár",
          mo: function (c) {
            return c === 1 ? "mánaður" : "mánaðir";
          },
          w: function (c) {
            return c === 1 ? "vika" : "vikur";
          },
          d: function (c) {
            return c === 1 ? "dagur" : "dagar";
          },
          h: function (c) {
            return c === 1 ? "tími" : "tímar";
          },
          m: function (c) {
            return c === 1 ? "minuttur" : "minuttir";
          },
          s: "sekund",
          ms: "millisekund",
          decimal: ","
        },
        fr: {
          y: function (c) {
            return "an" + (c >= 2 ? "s" : "");
          },
          mo: "mois",
          w: function (c) {
            return "semaine" + (c >= 2 ? "s" : "");
          },
          d: function (c) {
            return "jour" + (c >= 2 ? "s" : "");
          },
          h: function (c) {
            return "heure" + (c >= 2 ? "s" : "");
          },
          m: function (c) {
            return "minute" + (c >= 2 ? "s" : "");
          },
          s: function (c) {
            return "seconde" + (c >= 2 ? "s" : "");
          },
          ms: function (c) {
            return "milliseconde" + (c >= 2 ? "s" : "");
          },
          decimal: ","
        },
        gr: greek,
        he: {
          y: function (c) {
            return c === 1 ? "שנה" : "שנים";
          },
          mo: function (c) {
            return c === 1 ? "חודש" : "חודשים";
          },
          w: function (c) {
            return c === 1 ? "שבוע" : "שבועות";
          },
          d: function (c) {
            return c === 1 ? "יום" : "ימים";
          },
          h: function (c) {
            return c === 1 ? "שעה" : "שעות";
          },
          m: function (c) {
            return c === 1 ? "דקה" : "דקות";
          },
          s: function (c) {
            return c === 1 ? "שניה" : "שניות";
          },
          ms: function (c) {
            return c === 1 ? "מילישנייה" : "מילישניות";
          },
          decimal: "."
        },
        hr: {
          y: function (c) {
            if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
              return "godine";
            }
            return "godina";
          },
          mo: function (c) {
            if (c === 1) {
              return "mjesec";
            } else if (c === 2 || c === 3 || c === 4) {
              return "mjeseca";
            }
            return "mjeseci";
          },
          w: function (c) {
            if (c % 10 === 1 && c !== 11) {
              return "tjedan";
            }
            return "tjedna";
          },
          d: function (c) {
            return c === 1 ? "dan" : "dana";
          },
          h: function (c) {
            if (c === 1) {
              return "sat";
            } else if (c === 2 || c === 3 || c === 4) {
              return "sata";
            }
            return "sati";
          },
          m: function (c) {
            var mod10 = c % 10;
            if ((mod10 === 2 || mod10 === 3 || mod10 === 4) && (c < 10 || c > 14)) {
              return "minute";
            }
            return "minuta";
          },
          s: function (c) {
            var mod10 = c % 10;
            if (mod10 === 5 || (Math.floor(c) === c && c >= 10 && c <= 19)) {
              return "sekundi";
            } else if (mod10 === 1) {
              return "sekunda";
            } else if (mod10 === 2 || mod10 === 3 || mod10 === 4) {
              return "sekunde";
            }
            return "sekundi";
          },
          ms: function (c) {
            if (c === 1) {
              return "milisekunda";
            } else if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
              return "milisekunde";
            }
            return "milisekundi";
          },
          decimal: ","
        },
        hi: {
          y: "साल",
          mo: function (c) {
            return c === 1 ? "महीना" : "महीने";
          },
          w: function (c) {
            return c === 1 ? "हफ़्ता" : "हफ्ते";
          },
          d: "दिन",
          h: function (c) {
            return c === 1 ? "घंटा" : "घंटे";
          },
          m: "मिनट",
          s: "सेकंड",
          ms: "मिलीसेकंड",
          decimal: "."
        },
        hu: {
          y: "év",
          mo: "hónap",
          w: "hét",
          d: "nap",
          h: "óra",
          m: "perc",
          s: "másodperc",
          ms: "ezredmásodperc",
          decimal: ","
        },
        id: {
          y: "tahun",
          mo: "bulan",
          w: "minggu",
          d: "hari",
          h: "jam",
          m: "menit",
          s: "detik",
          ms: "milidetik",
          decimal: "."
        },
        is: {
          y: "ár",
          mo: function (c) {
            return "mánuð" + (c === 1 ? "ur" : "ir");
          },
          w: function (c) {
            return "vik" + (c === 1 ? "a" : "ur");
          },
          d: function (c) {
            return "dag" + (c === 1 ? "ur" : "ar");
          },
          h: function (c) {
            return "klukkutím" + (c === 1 ? "i" : "ar");
          },
          m: function (c) {
            return "mínút" + (c === 1 ? "a" : "ur");
          },
          s: function (c) {
            return "sekúnd" + (c === 1 ? "a" : "ur");
          },
          ms: function (c) {
            return "millisekúnd" + (c === 1 ? "a" : "ur");
          },
          decimal: "."
        },
        it: {
          y: function (c) {
            return "ann" + (c === 1 ? "o" : "i");
          },
          mo: function (c) {
            return "mes" + (c === 1 ? "e" : "i");
          },
          w: function (c) {
            return "settiman" + (c === 1 ? "a" : "e");
          },
          d: function (c) {
            return "giorn" + (c === 1 ? "o" : "i");
          },
          h: function (c) {
            return "or" + (c === 1 ? "a" : "e");
          },
          m: function (c) {
            return "minut" + (c === 1 ? "o" : "i");
          },
          s: function (c) {
            return "second" + (c === 1 ? "o" : "i");
          },
          ms: function (c) {
            return "millisecond" + (c === 1 ? "o" : "i");
          },
          decimal: ","
        },
        ja: {
          y: "年",
          mo: "月",
          w: "週",
          d: "日",
          h: "時間",
          m: "分",
          s: "秒",
          ms: "ミリ秒",
          decimal: "."
        },
        km: {
          y: "ឆ្នាំ",
          mo: "ខែ",
          w: "សប្តាហ៍",
          d: "ថ្ងៃ",
          h: "ម៉ោង",
          m: "នាទី",
          s: "វិនាទី",
          ms: "មិល្លីវិនាទី"
        },
        kn: {
          y: function (c) {
            return c === 1 ? "ವರ್ಷ" : "ವರ್ಷಗಳು";
          },
          mo: function (c) {
            return c === 1 ? "ತಿಂಗಳು" : "ತಿಂಗಳುಗಳು";
          },
          w: function (c) {
            return c === 1 ? "ವಾರ" : "ವಾರಗಳು";
          },
          d: function (c) {
            return c === 1 ? "ದಿನ" : "ದಿನಗಳು";
          },
          h: function (c) {
            return c === 1 ? "ಗಂಟೆ" : "ಗಂಟೆಗಳು";
          },
          m: function (c) {
            return c === 1 ? "ನಿಮಿಷ" : "ನಿಮಿಷಗಳು";
          },
          s: function (c) {
            return c === 1 ? "ಸೆಕೆಂಡ್" : "ಸೆಕೆಂಡುಗಳು";
          },
          ms: function (c) {
            return c === 1 ? "ಮಿಲಿಸೆಕೆಂಡ್" : "ಮಿಲಿಸೆಕೆಂಡುಗಳು";
          }
        },
        ko: {
          y: "년",
          mo: "개월",
          w: "주일",
          d: "일",
          h: "시간",
          m: "분",
          s: "초",
          ms: "밀리 초",
          decimal: "."
        },
        ku: {
          y: "sal",
          mo: "meh",
          w: "hefte",
          d: "roj",
          h: "seet",
          m: "deqe",
          s: "saniye",
          ms: "mîlîçirk",
          decimal: ","
        },
        lo: {
          y: "ປີ",
          mo: "ເດືອນ",
          w: "ອາທິດ",
          d: "ມື້",
          h: "ຊົ່ວໂມງ",
          m: "ນາທີ",
          s: "ວິນາທີ",
          ms: "ມິນລິວິນາທີ",
          decimal: ","
        },
        lt: {
          y: function (c) {
            return c % 10 === 0 || (c % 100 >= 10 && c % 100 <= 20)
              ? "metų"
              : "metai";
          },
          mo: function (c) {
            return ["mėnuo", "mėnesiai", "mėnesių"][getLithuanianForm(c)];
          },
          w: function (c) {
            return ["savaitė", "savaitės", "savaičių"][getLithuanianForm(c)];
          },
          d: function (c) {
            return ["diena", "dienos", "dienų"][getLithuanianForm(c)];
          },
          h: function (c) {
            return ["valanda", "valandos", "valandų"][getLithuanianForm(c)];
          },
          m: function (c) {
            return ["minutė", "minutės", "minučių"][getLithuanianForm(c)];
          },
          s: function (c) {
            return ["sekundė", "sekundės", "sekundžių"][getLithuanianForm(c)];
          },
          ms: function (c) {
            return ["milisekundė", "milisekundės", "milisekundžių"][
              getLithuanianForm(c)
            ];
          },
          decimal: ","
        },
        lv: {
          y: function (c) {
            return getLatvianForm(c) ? "gads" : "gadi";
          },
          mo: function (c) {
            return getLatvianForm(c) ? "mēnesis" : "mēneši";
          },
          w: function (c) {
            return getLatvianForm(c) ? "nedēļa" : "nedēļas";
          },
          d: function (c) {
            return getLatvianForm(c) ? "diena" : "dienas";
          },
          h: function (c) {
            return getLatvianForm(c) ? "stunda" : "stundas";
          },
          m: function (c) {
            return getLatvianForm(c) ? "minūte" : "minūtes";
          },
          s: function (c) {
            return getLatvianForm(c) ? "sekunde" : "sekundes";
          },
          ms: function (c) {
            return getLatvianForm(c) ? "milisekunde" : "milisekundes";
          },
          decimal: ","
        },
        mk: {
          y: function (c) {
            return c === 1 ? "година" : "години";
          },
          mo: function (c) {
            return c === 1 ? "месец" : "месеци";
          },
          w: function (c) {
            return c === 1 ? "недела" : "недели";
          },
          d: function (c) {
            return c === 1 ? "ден" : "дена";
          },
          h: function (c) {
            return c === 1 ? "час" : "часа";
          },
          m: function (c) {
            return c === 1 ? "минута" : "минути";
          },
          s: function (c) {
            return c === 1 ? "секунда" : "секунди";
          },
          ms: function (c) {
            return c === 1 ? "милисекунда" : "милисекунди";
          },
          decimal: ","
        },
        mr: {
          y: function (c) {
            return c === 1 ? "वर्ष" : "वर्षे";
          },
          mo: function (c) {
            return c === 1 ? "महिना" : "महिने";
          },
          w: function (c) {
            return c === 1 ? "आठवडा" : "आठवडे";
          },
          d: "दिवस",
          h: "तास",
          m: function (c) {
            return c === 1 ? "मिनिट" : "मिनिटे";
          },
          s: "सेकंद",
          ms: "मिलिसेकंद"
        },
        ms: {
          y: "tahun",
          mo: "bulan",
          w: "minggu",
          d: "hari",
          h: "jam",
          m: "minit",
          s: "saat",
          ms: "milisaat",
          decimal: "."
        },
        nl: {
          y: "jaar",
          mo: function (c) {
            return c === 1 ? "maand" : "maanden";
          },
          w: function (c) {
            return c === 1 ? "week" : "weken";
          },
          d: function (c) {
            return c === 1 ? "dag" : "dagen";
          },
          h: "uur",
          m: function (c) {
            return c === 1 ? "minuut" : "minuten";
          },
          s: function (c) {
            return c === 1 ? "seconde" : "seconden";
          },
          ms: function (c) {
            return c === 1 ? "milliseconde" : "milliseconden";
          },
          decimal: ","
        },
        no: {
          y: "år",
          mo: function (c) {
            return "måned" + (c === 1 ? "" : "er");
          },
          w: function (c) {
            return "uke" + (c === 1 ? "" : "r");
          },
          d: function (c) {
            return "dag" + (c === 1 ? "" : "er");
          },
          h: function (c) {
            return "time" + (c === 1 ? "" : "r");
          },
          m: function (c) {
            return "minutt" + (c === 1 ? "" : "er");
          },
          s: function (c) {
            return "sekund" + (c === 1 ? "" : "er");
          },
          ms: function (c) {
            return "millisekund" + (c === 1 ? "" : "er");
          },
          decimal: ","
        },
        pl: {
          y: function (c) {
            return ["rok", "roku", "lata", "lat"][getPolishForm(c)];
          },
          mo: function (c) {
            return ["miesiąc", "miesiąca", "miesiące", "miesięcy"][
              getPolishForm(c)
            ];
          },
          w: function (c) {
            return ["tydzień", "tygodnia", "tygodnie", "tygodni"][getPolishForm(c)];
          },
          d: function (c) {
            return ["dzień", "dnia", "dni", "dni"][getPolishForm(c)];
          },
          h: function (c) {
            return ["godzina", "godziny", "godziny", "godzin"][getPolishForm(c)];
          },
          m: function (c) {
            return ["minuta", "minuty", "minuty", "minut"][getPolishForm(c)];
          },
          s: function (c) {
            return ["sekunda", "sekundy", "sekundy", "sekund"][getPolishForm(c)];
          },
          ms: function (c) {
            return ["milisekunda", "milisekundy", "milisekundy", "milisekund"][
              getPolishForm(c)
            ];
          },
          decimal: ","
        },
        pt: {
          y: function (c) {
            return "ano" + (c === 1 ? "" : "s");
          },
          mo: function (c) {
            return c === 1 ? "mês" : "meses";
          },
          w: function (c) {
            return "semana" + (c === 1 ? "" : "s");
          },
          d: function (c) {
            return "dia" + (c === 1 ? "" : "s");
          },
          h: function (c) {
            return "hora" + (c === 1 ? "" : "s");
          },
          m: function (c) {
            return "minuto" + (c === 1 ? "" : "s");
          },
          s: function (c) {
            return "segundo" + (c === 1 ? "" : "s");
          },
          ms: function (c) {
            return "milissegundo" + (c === 1 ? "" : "s");
          },
          decimal: ","
        },
        ro: {
          y: function (c) {
            return c === 1 ? "an" : "ani";
          },
          mo: function (c) {
            return c === 1 ? "lună" : "luni";
          },
          w: function (c) {
            return c === 1 ? "săptămână" : "săptămâni";
          },
          d: function (c) {
            return c === 1 ? "zi" : "zile";
          },
          h: function (c) {
            return c === 1 ? "oră" : "ore";
          },
          m: function (c) {
            return c === 1 ? "minut" : "minute";
          },
          s: function (c) {
            return c === 1 ? "secundă" : "secunde";
          },
          ms: function (c) {
            return c === 1 ? "milisecundă" : "milisecunde";
          },
          decimal: ","
        },
        ru: {
          y: function (c) {
            return ["лет", "год", "года"][getSlavicForm(c)];
          },
          mo: function (c) {
            return ["месяцев", "месяц", "месяца"][getSlavicForm(c)];
          },
          w: function (c) {
            return ["недель", "неделя", "недели"][getSlavicForm(c)];
          },
          d: function (c) {
            return ["дней", "день", "дня"][getSlavicForm(c)];
          },
          h: function (c) {
            return ["часов", "час", "часа"][getSlavicForm(c)];
          },
          m: function (c) {
            return ["минут", "минута", "минуты"][getSlavicForm(c)];
          },
          s: function (c) {
            return ["секунд", "секунда", "секунды"][getSlavicForm(c)];
          },
          ms: function (c) {
            return ["миллисекунд", "миллисекунда", "миллисекунды"][
              getSlavicForm(c)
            ];
          },
          decimal: ","
        },
        sq: {
          y: function (c) {
            return c === 1 ? "vit" : "vjet";
          },
          mo: "muaj",
          w: "javë",
          d: "ditë",
          h: "orë",
          m: function (c) {
            return "minut" + (c === 1 ? "ë" : "a");
          },
          s: function (c) {
            return "sekond" + (c === 1 ? "ë" : "a");
          },
          ms: function (c) {
            return "milisekond" + (c === 1 ? "ë" : "a");
          },
          decimal: ","
        },
        sr: {
          y: function (c) {
            return ["години", "година", "године"][getSlavicForm(c)];
          },
          mo: function (c) {
            return ["месеци", "месец", "месеца"][getSlavicForm(c)];
          },
          w: function (c) {
            return ["недељи", "недеља", "недеље"][getSlavicForm(c)];
          },
          d: function (c) {
            return ["дани", "дан", "дана"][getSlavicForm(c)];
          },
          h: function (c) {
            return ["сати", "сат", "сата"][getSlavicForm(c)];
          },
          m: function (c) {
            return ["минута", "минут", "минута"][getSlavicForm(c)];
          },
          s: function (c) {
            return ["секунди", "секунда", "секунде"][getSlavicForm(c)];
          },
          ms: function (c) {
            return ["милисекунди", "милисекунда", "милисекунде"][getSlavicForm(c)];
          },
          decimal: ","
        },
        ta: {
          y: function (c) {
            return c === 1 ? "வருடம்" : "ஆண்டுகள்";
          },
          mo: function (c) {
            return c === 1 ? "மாதம்" : "மாதங்கள்";
          },
          w: function (c) {
            return c === 1 ? "வாரம்" : "வாரங்கள்";
          },
          d: function (c) {
            return c === 1 ? "நாள்" : "நாட்கள்";
          },
          h: function (c) {
            return c === 1 ? "மணி" : "மணிநேரம்";
          },
          m: function (c) {
            return "நிமிட" + (c === 1 ? "ம்" : "ங்கள்");
          },
          s: function (c) {
            return "வினாடி" + (c === 1 ? "" : "கள்");
          },
          ms: function (c) {
            return "மில்லி விநாடி" + (c === 1 ? "" : "கள்");
          }
        },
        te: {
          y: function (c) {
            return "సంవత్స" + (c === 1 ? "రం" : "రాల");
          },
          mo: function (c) {
            return "నెల" + (c === 1 ? "" : "ల");
          },
          w: function (c) {
            return c === 1 ? "వారం" : "వారాలు";
          },
          d: function (c) {
            return "రోజు" + (c === 1 ? "" : "లు");
          },
          h: function (c) {
            return "గంట" + (c === 1 ? "" : "లు");
          },
          m: function (c) {
            return c === 1 ? "నిమిషం" : "నిమిషాలు";
          },
          s: function (c) {
            return c === 1 ? "సెకను" : "సెకన్లు";
          },
          ms: function (c) {
            return c === 1 ? "మిల్లీసెకన్" : "మిల్లీసెకన్లు";
          }
        },
        uk: {
          y: function (c) {
            return ["років", "рік", "роки"][getSlavicForm(c)];
          },
          mo: function (c) {
            return ["місяців", "місяць", "місяці"][getSlavicForm(c)];
          },
          w: function (c) {
            return ["тижнів", "тиждень", "тижні"][getSlavicForm(c)];
          },
          d: function (c) {
            return ["днів", "день", "дні"][getSlavicForm(c)];
          },
          h: function (c) {
            return ["годин", "година", "години"][getSlavicForm(c)];
          },
          m: function (c) {
            return ["хвилин", "хвилина", "хвилини"][getSlavicForm(c)];
          },
          s: function (c) {
            return ["секунд", "секунда", "секунди"][getSlavicForm(c)];
          },
          ms: function (c) {
            return ["мілісекунд", "мілісекунда", "мілісекунди"][getSlavicForm(c)];
          },
          decimal: ","
        },
        ur: {
          y: "سال",
          mo: function (c) {
            return c === 1 ? "مہینہ" : "مہینے";
          },
          w: function (c) {
            return c === 1 ? "ہفتہ" : "ہفتے";
          },
          d: "دن",
          h: function (c) {
            return c === 1 ? "گھنٹہ" : "گھنٹے";
          },
          m: "منٹ",
          s: "سیکنڈ",
          ms: "ملی سیکنڈ",
          decimal: "."
        },
        sk: {
          y: function (c) {
            return ["rok", "roky", "roky", "rokov"][getCzechOrSlovakForm(c)];
          },
          mo: function (c) {
            return ["mesiac", "mesiace", "mesiace", "mesiacov"][
              getCzechOrSlovakForm(c)
            ];
          },
          w: function (c) {
            return ["týždeň", "týždne", "týždne", "týždňov"][
              getCzechOrSlovakForm(c)
            ];
          },
          d: function (c) {
            return ["deň", "dni", "dni", "dní"][getCzechOrSlovakForm(c)];
          },
          h: function (c) {
            return ["hodina", "hodiny", "hodiny", "hodín"][getCzechOrSlovakForm(c)];
          },
          m: function (c) {
            return ["minúta", "minúty", "minúty", "minút"][getCzechOrSlovakForm(c)];
          },
          s: function (c) {
            return ["sekunda", "sekundy", "sekundy", "sekúnd"][
              getCzechOrSlovakForm(c)
            ];
          },
          ms: function (c) {
            return ["milisekunda", "milisekundy", "milisekundy", "milisekúnd"][
              getCzechOrSlovakForm(c)
            ];
          },
          decimal: ","
        },
        sl: {
          y: function (c) {
            if (c % 10 === 1) {
              return "leto";
            } else if (c % 100 === 2) {
              return "leti";
            } else if (
              c % 100 === 3 ||
              c % 100 === 4 ||
              (Math.floor(c) !== c && c % 100 <= 5)
            ) {
              return "leta";
            } else {
              return "let";
            }
          },
          mo: function (c) {
            if (c % 10 === 1) {
              return "mesec";
            } else if (c % 100 === 2 || (Math.floor(c) !== c && c % 100 <= 5)) {
              return "meseca";
            } else if (c % 10 === 3 || c % 10 === 4) {
              return "mesece";
            } else {
              return "mesecev";
            }
          },
          w: function (c) {
            if (c % 10 === 1) {
              return "teden";
            } else if (c % 10 === 2 || (Math.floor(c) !== c && c % 100 <= 4)) {
              return "tedna";
            } else if (c % 10 === 3 || c % 10 === 4) {
              return "tedne";
            } else {
              return "tednov";
            }
          },
          d: function (c) {
            return c % 100 === 1 ? "dan" : "dni";
          },
          h: function (c) {
            if (c % 10 === 1) {
              return "ura";
            } else if (c % 100 === 2) {
              return "uri";
            } else if (c % 10 === 3 || c % 10 === 4 || Math.floor(c) !== c) {
              return "ure";
            } else {
              return "ur";
            }
          },
          m: function (c) {
            if (c % 10 === 1) {
              return "minuta";
            } else if (c % 10 === 2) {
              return "minuti";
            } else if (
              c % 10 === 3 ||
              c % 10 === 4 ||
              (Math.floor(c) !== c && c % 100 <= 4)
            ) {
              return "minute";
            } else {
              return "minut";
            }
          },
          s: function (c) {
            if (c % 10 === 1) {
              return "sekunda";
            } else if (c % 100 === 2) {
              return "sekundi";
            } else if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
              return "sekunde";
            } else {
              return "sekund";
            }
          },
          ms: function (c) {
            if (c % 10 === 1) {
              return "milisekunda";
            } else if (c % 100 === 2) {
              return "milisekundi";
            } else if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
              return "milisekunde";
            } else {
              return "milisekund";
            }
          },
          decimal: ","
        },
        sv: {
          y: "år",
          mo: function (c) {
            return "månad" + (c === 1 ? "" : "er");
          },
          w: function (c) {
            return "veck" + (c === 1 ? "a" : "or");
          },
          d: function (c) {
            return "dag" + (c === 1 ? "" : "ar");
          },
          h: function (c) {
            return "timm" + (c === 1 ? "e" : "ar");
          },
          m: function (c) {
            return "minut" + (c === 1 ? "" : "er");
          },
          s: function (c) {
            return "sekund" + (c === 1 ? "" : "er");
          },
          ms: function (c) {
            return "millisekund" + (c === 1 ? "" : "er");
          },
          decimal: ","
        },
        sw: {
          y: function (c) {
            return c === 1 ? "mwaka" : "miaka";
          },
          mo: function (c) {
            return c === 1 ? "mwezi" : "miezi";
          },
          w: "wiki",
          d: function (c) {
            return c === 1 ? "siku" : "masiku";
          },
          h: function (c) {
            return c === 1 ? "saa" : "masaa";
          },
          m: "dakika",
          s: "sekunde",
          ms: "milisekunde",
          decimal: "."
        },
        tr: {
          y: "yıl",
          mo: "ay",
          w: "hafta",
          d: "gün",
          h: "saat",
          m: "dakika",
          s: "saniye",
          ms: "milisaniye",
          decimal: ","
        },
        th: {
          y: "ปี",
          mo: "เดือน",
          w: "สัปดาห์",
          d: "วัน",
          h: "ชั่วโมง",
          m: "นาที",
          s: "วินาที",
          ms: "มิลลิวินาที",
          decimal: "."
        },
        vi: {
          y: "năm",
          mo: "tháng",
          w: "tuần",
          d: "ngày",
          h: "giờ",
          m: "phút",
          s: "giây",
          ms: "mili giây",
          decimal: ","
        },
        zh_CN: {
          y: "年",
          mo: "个月",
          w: "周",
          d: "天",
          h: "小时",
          m: "分钟",
          s: "秒",
          ms: "毫秒",
          decimal: "."
        },
        zh_TW: {
          y: "年",
          mo: "個月",
          w: "周",
          d: "天",
          h: "小時",
          m: "分鐘",
          s: "秒",
          ms: "毫秒",
          decimal: "."
        }
      };

      // You can create a humanizer, which returns a function with default
      // parameters.
      function humanizer(passedOptions) {
        var result = function humanizer(ms, humanizerOptions) {
          var options = assign({}, result, humanizerOptions || {});
          return doHumanization(ms, options);
        };

        return assign(
          result,
          {
            language: "en",
            spacer: " ",
            conjunction: "",
            serialComma: true,
            units: ["y", "mo", "w", "d", "h", "m", "s"],
            languages: {},
            round: false,
            unitMeasures: {
              y: 31557600000,
              mo: 2629800000,
              w: 604800000,
              d: 86400000,
              h: 3600000,
              m: 60000,
              s: 1000,
              ms: 1
            }
          },
          passedOptions
        );
      }

      // The main function is just a wrapper around a default humanizer.
      var humanizeDuration = humanizer({});

      // Build dictionary from options
      function getDictionary(options) {
        var languagesFromOptions = [options.language];

        if (has(options, "fallbacks")) {
          if (isArray(options.fallbacks) && options.fallbacks.length) {
            languagesFromOptions = languagesFromOptions.concat(options.fallbacks);
          } else {
            throw new Error("fallbacks must be an array with at least one element");
          }
        }

        for (var i = 0; i < languagesFromOptions.length; i++) {
          var languageToTry = languagesFromOptions[i];
          if (has(options.languages, languageToTry)) {
            return options.languages[languageToTry];
          } else if (has(LANGUAGES, languageToTry)) {
            return LANGUAGES[languageToTry];
          }
        }

        throw new Error("No language found.");
      }

      // doHumanization does the bulk of the work.
      function doHumanization(ms, options) {
        var i, len, piece;

        // Make sure we have a positive number.
        // Has the nice sideffect of turning Number objects into primitives.
        ms = Math.abs(ms);

        var dictionary = getDictionary(options);
        var pieces = [];

        // Start at the top and keep removing units, bit by bit.
        var unitName, unitMS, unitCount;
        for (i = 0, len = options.units.length; i < len; i++) {
          unitName = options.units[i];
          unitMS = options.unitMeasures[unitName];

          // What's the number of full units we can fit?
          if (i + 1 === len) {
            if (has(options, "maxDecimalPoints")) {
              // We need to use this expValue to avoid rounding functionality of toFixed call
              var expValue = Math.pow(10, options.maxDecimalPoints);
              var unitCountFloat = ms / unitMS;
              unitCount = parseFloat(
                (Math.floor(expValue * unitCountFloat) / expValue).toFixed(
                  options.maxDecimalPoints
                )
              );
            } else {
              unitCount = ms / unitMS;
            }
          } else {
            unitCount = Math.floor(ms / unitMS);
          }

          // Add the string.
          pieces.push({
            unitCount: unitCount,
            unitName: unitName
          });

          // Remove what we just figured out.
          ms -= unitCount * unitMS;
        }

        var firstOccupiedUnitIndex = 0;
        for (i = 0; i < pieces.length; i++) {
          if (pieces[i].unitCount) {
            firstOccupiedUnitIndex = i;
            break;
          }
        }

        if (options.round) {
          var ratioToLargerUnit, previousPiece;
          for (i = pieces.length - 1; i >= 0; i--) {
            piece = pieces[i];
            piece.unitCount = Math.round(piece.unitCount);

            if (i === 0) {
              break;
            }

            previousPiece = pieces[i - 1];

            ratioToLargerUnit =
              options.unitMeasures[previousPiece.unitName] /
              options.unitMeasures[piece.unitName];
            if (
              piece.unitCount % ratioToLargerUnit === 0 ||
              (options.largest && options.largest - 1 < i - firstOccupiedUnitIndex)
            ) {
              previousPiece.unitCount += piece.unitCount / ratioToLargerUnit;
              piece.unitCount = 0;
            }
          }
        }

        var result = [];
        for (i = 0, pieces.length; i < len; i++) {
          piece = pieces[i];
          if (piece.unitCount) {
            result.push(
              render(piece.unitCount, piece.unitName, dictionary, options)
            );
          }

          if (result.length === options.largest) {
            break;
          }
        }

        if (result.length) {
          var delimiter;
          if (has(options, "delimiter")) {
            delimiter = options.delimiter;
          } else if (has(dictionary, "delimiter")) {
            delimiter = dictionary.delimiter;
          } else {
            delimiter = ", ";
          }

          if (!options.conjunction || result.length === 1) {
            return result.join(delimiter);
          } else if (result.length === 2) {
            return result.join(options.conjunction);
          } else if (result.length > 2) {
            return (
              result.slice(0, -1).join(delimiter) +
              (options.serialComma ? "," : "") +
              options.conjunction +
              result.slice(-1)
            );
          }
        } else {
          return render(
            0,
            options.units[options.units.length - 1],
            dictionary,
            options
          );
        }
      }

      function render(count, type, dictionary, options) {
        var decimal;
        if (has(options, "decimal")) {
          decimal = options.decimal;
        } else if (has(dictionary, "decimal")) {
          decimal = dictionary.decimal;
        } else {
          decimal = ".";
        }

        var countStr;
        if (typeof dictionary._formatCount === "function") {
          countStr = dictionary._formatCount(count, decimal);
        } else {
          countStr = count.toString().replace(".", decimal);
        }

        var dictionaryValue = dictionary[type];
        var word;
        if (typeof dictionaryValue === "function") {
          word = dictionaryValue(count);
        } else {
          word = dictionaryValue;
        }

        return countStr + options.spacer + word;
      }

      function assign(destination) {
        var source;
        for (var i = 1; i < arguments.length; i++) {
          source = arguments[i];
          for (var prop in source) {
            if (has(source, prop)) {
              destination[prop] = source[prop];
            }
          }
        }
        return destination;
      }

      function getArabicForm(c) {
        if (c === 1) {
          return 0;
        }
        if (c === 2) {
          return 1;
        }
        if (c > 2 && c < 11) {
          return 2;
        }
        return 0;
      }

      function getPolishForm(c) {
        if (c === 1) {
          return 0;
        } else if (Math.floor(c) !== c) {
          return 1;
        } else if (c % 10 >= 2 && c % 10 <= 4 && !(c % 100 > 10 && c % 100 < 20)) {
          return 2;
        } else {
          return 3;
        }
      }

      function getSlavicForm(c) {
        if (Math.floor(c) !== c) {
          return 2;
        } else if (
          (c % 100 >= 5 && c % 100 <= 20) ||
          (c % 10 >= 5 && c % 10 <= 9) ||
          c % 10 === 0
        ) {
          return 0;
        } else if (c % 10 === 1) {
          return 1;
        } else if (c > 1) {
          return 2;
        } else {
          return 0;
        }
      }

      function getCzechOrSlovakForm(c) {
        if (c === 1) {
          return 0;
        } else if (Math.floor(c) !== c) {
          return 1;
        } else if (c % 10 >= 2 && c % 10 <= 4 && c % 100 < 10) {
          return 2;
        } else {
          return 3;
        }
      }

      function getLithuanianForm(c) {
        if (c === 1 || (c % 10 === 1 && c % 100 > 20)) {
          return 0;
        } else if (
          Math.floor(c) !== c ||
          (c % 10 >= 2 && c % 100 > 20) ||
          (c % 10 >= 2 && c % 100 < 10)
        ) {
          return 1;
        } else {
          return 2;
        }
      }

      function getLatvianForm(c) {
        return c % 10 === 1 && c % 100 !== 11;
      }

      // We need to make sure we support browsers that don't have
      // `Array.isArray`, so we define a fallback here.
      var isArray =
        Array.isArray ||
        function (arg) {
          return Object.prototype.toString.call(arg) === "[object Array]";
        };

      function has(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
      }

      humanizeDuration.getSupportedLanguages = function getSupportedLanguages() {
        var result = [];
        for (var language in LANGUAGES) {
          if (has(LANGUAGES, language) && language !== "gr") {
            result.push(language);
          }
        }
        return result;
      };

      humanizeDuration.humanizer = humanizer;

      if ( module.exports) {
        module.exports = humanizeDuration;
      } else {
        this.humanizeDuration = humanizeDuration;
      }
    })();
    });

    /* src\components\Button.svelte generated by Svelte v3.42.1 */

    const file = "src\\components\\Button.svelte";

    function create_fragment(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(/*text*/ ctx[2]);
    			attr_dev(button, "class", "button svelte-1ma4wdu");
    			toggle_class(button, "button--primary", /*primary*/ ctx[0]);
    			toggle_class(button, "button--secondary", /*secondary*/ ctx[1]);
    			add_location(button, file, 6, 0, 107);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*text*/ 4) set_data_dev(t, /*text*/ ctx[2]);

    			if (dirty & /*primary*/ 1) {
    				toggle_class(button, "button--primary", /*primary*/ ctx[0]);
    			}

    			if (dirty & /*secondary*/ 2) {
    				toggle_class(button, "button--secondary", /*secondary*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, []);
    	let { primary = false } = $$props;
    	let { secondary = false } = $$props;
    	let { text } = $$props;
    	const writable_props = ['primary', 'secondary', 'text'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('primary' in $$props) $$invalidate(0, primary = $$props.primary);
    		if ('secondary' in $$props) $$invalidate(1, secondary = $$props.secondary);
    		if ('text' in $$props) $$invalidate(2, text = $$props.text);
    	};

    	$$self.$capture_state = () => ({ primary, secondary, text });

    	$$self.$inject_state = $$props => {
    		if ('primary' in $$props) $$invalidate(0, primary = $$props.primary);
    		if ('secondary' in $$props) $$invalidate(1, secondary = $$props.secondary);
    		if ('text' in $$props) $$invalidate(2, text = $$props.text);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [primary, secondary, text, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { primary: 0, secondary: 1, text: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*text*/ ctx[2] === undefined && !('text' in props)) {
    			console.warn("<Button> was created without expected prop 'text'");
    		}
    	}

    	get primary() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primary(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondary() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondary(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-icons\components\IconBase.svelte generated by Svelte v3.42.1 */

    const file$1 = "node_modules\\svelte-icons\\components\\IconBase.svelte";

    // (18:2) {#if title}
    function create_if_block(ctx) {
    	let title_1;
    	let t;

    	const block = {
    		c: function create() {
    			title_1 = svg_element("title");
    			t = text(/*title*/ ctx[0]);
    			add_location(title_1, file$1, 18, 4, 298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, title_1, anchor);
    			append_dev(title_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(title_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(18:2) {#if title}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let svg;
    	let if_block_anchor;
    	let current;
    	let if_block = /*title*/ ctx[0] && create_if_block(ctx);
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			if (default_slot) default_slot.c();
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", /*viewBox*/ ctx[1]);
    			attr_dev(svg, "class", "svelte-c8tyih");
    			add_location(svg, file$1, 16, 0, 229);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			if (if_block) if_block.m(svg, null);
    			append_dev(svg, if_block_anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*title*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(svg, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*viewBox*/ 2) {
    				attr_dev(svg, "viewBox", /*viewBox*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IconBase', slots, ['default']);
    	let { title = null } = $$props;
    	let { viewBox } = $$props;
    	const writable_props = ['title', 'viewBox'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IconBase> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('viewBox' in $$props) $$invalidate(1, viewBox = $$props.viewBox);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ title, viewBox });

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('viewBox' in $$props) $$invalidate(1, viewBox = $$props.viewBox);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, viewBox, $$scope, slots];
    }

    class IconBase extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { title: 0, viewBox: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconBase",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*viewBox*/ ctx[1] === undefined && !('viewBox' in props)) {
    			console.warn("<IconBase> was created without expected prop 'viewBox'");
    		}
    	}

    	get title() {
    		throw new Error("<IconBase>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<IconBase>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewBox() {
    		throw new Error("<IconBase>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set viewBox(value) {
    		throw new Error("<IconBase>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-icons\io\IoIosSettings.svelte generated by Svelte v3.42.1 */
    const file$2 = "node_modules\\svelte-icons\\io\\IoIosSettings.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M416.3 256c0-21 13.1-38.9 31.7-46.1-4.9-20.5-13-39.7-23.7-57.1-6.4 2.8-13.2 4.3-20.1 4.3-12.6 0-25.2-4.8-34.9-14.4-14.9-14.9-18.2-36.8-10.2-55-17.3-10.7-36.6-18.8-57-23.7C295 82.5 277 95.7 256 95.7S217 82.5 209.9 64c-20.5 4.9-39.7 13-57.1 23.7 8.1 18.1 4.7 40.1-10.2 55-9.6 9.6-22.3 14.4-34.9 14.4-6.9 0-13.7-1.4-20.1-4.3C77 170.3 68.9 189.5 64 210c18.5 7.1 31.7 25 31.7 46.1 0 21-13.1 38.9-31.6 46.1 4.9 20.5 13 39.7 23.7 57.1 6.4-2.8 13.2-4.2 20-4.2 12.6 0 25.2 4.8 34.9 14.4 14.8 14.8 18.2 36.8 10.2 54.9 17.4 10.7 36.7 18.8 57.1 23.7 7.1-18.5 25-31.6 46-31.6s38.9 13.1 46 31.6c20.5-4.9 39.7-13 57.1-23.7-8-18.1-4.6-40 10.2-54.9 9.6-9.6 22.2-14.4 34.9-14.4 6.8 0 13.7 1.4 20 4.2 10.7-17.4 18.8-36.7 23.7-57.1-18.4-7.2-31.6-25.1-31.6-46.2zm-159.4 79.9c-44.3 0-80-35.9-80-80s35.7-80 80-80 80 35.9 80 80-35.7 80-80 80z");
    			add_location(path, file$2, 4, 10, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let iconbase;
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	iconbase = new IconBase({ props: iconbase_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(iconbase.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(iconbase, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const iconbase_changes = (dirty & /*$$props*/ 1)
    			? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
    			: {};

    			if (dirty & /*$$scope*/ 2) {
    				iconbase_changes.$$scope = { dirty, ctx };
    			}

    			iconbase.$set(iconbase_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconbase.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconbase.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iconbase, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IoIosSettings', slots, []);

    	$$self.$$set = $$new_props => {
    		$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    	};

    	$$self.$capture_state = () => ({ IconBase });

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$props = exclude_internal_props($$props);
    	return [$$props];
    }

    class IoIosSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoIosSettings",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* node_modules\svelte-icons\io\IoIosClose.svelte generated by Svelte v3.42.1 */
    const file$3 = "node_modules\\svelte-icons\\io\\IoIosClose.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$1(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M278.6 256l68.2-68.2c6.2-6.2 6.2-16.4 0-22.6-6.2-6.2-16.4-6.2-22.6 0L256 233.4l-68.2-68.2c-6.2-6.2-16.4-6.2-22.6 0-3.1 3.1-4.7 7.2-4.7 11.3 0 4.1 1.6 8.2 4.7 11.3l68.2 68.2-68.2 68.2c-3.1 3.1-4.7 7.2-4.7 11.3 0 4.1 1.6 8.2 4.7 11.3 6.2 6.2 16.4 6.2 22.6 0l68.2-68.2 68.2 68.2c6.2 6.2 16.4 6.2 22.6 0 6.2-6.2 6.2-16.4 0-22.6L278.6 256z");
    			add_location(path, file$3, 4, 10, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let iconbase;
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	iconbase = new IconBase({ props: iconbase_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(iconbase.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(iconbase, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const iconbase_changes = (dirty & /*$$props*/ 1)
    			? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
    			: {};

    			if (dirty & /*$$scope*/ 2) {
    				iconbase_changes.$$scope = { dirty, ctx };
    			}

    			iconbase.$set(iconbase_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconbase.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconbase.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iconbase, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IoIosClose', slots, []);

    	$$self.$$set = $$new_props => {
    		$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    	};

    	$$self.$capture_state = () => ({ IconBase });

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$props = exclude_internal_props($$props);
    	return [$$props];
    }

    class IoIosClose extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoIosClose",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* node_modules\svelte-switch\src\components\CheckedIcon.svelte generated by Svelte v3.42.1 */

    const file$4 = "node_modules\\svelte-switch\\src\\components\\CheckedIcon.svelte";

    function create_fragment$4(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M11.264 0L5.26 6.004 2.103 2.847 0 4.95l5.26 5.26 8.108-8.107L11.264 0");
    			attr_dev(path, "fill", "#fff");
    			attr_dev(path, "fillrule", "evenodd");
    			add_location(path, file$4, 5, 2, 105);
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "viewBox", "-2 -5 17 21");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			add_location(svg, file$4, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CheckedIcon', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CheckedIcon> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class CheckedIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CheckedIcon",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* node_modules\svelte-switch\src\components\UncheckedIcon.svelte generated by Svelte v3.42.1 */

    const file$5 = "node_modules\\svelte-switch\\src\\components\\UncheckedIcon.svelte";

    function create_fragment$5(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M9.9 2.12L7.78 0 4.95 2.828 2.12 0 0 2.12l2.83 2.83L0 7.776 2.123 9.9\r\n    4.95 7.07 7.78 9.9 9.9 7.776 7.072 4.95 9.9 2.12");
    			attr_dev(path, "fill", "#fff");
    			attr_dev(path, "fillrule", "evenodd");
    			add_location(path, file$5, 5, 2, 106);
    			attr_dev(svg, "viewBox", "-2 -5 14 20");
    			attr_dev(svg, "height", "100%");
    			attr_dev(svg, "width", "100%");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			add_location(svg, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('UncheckedIcon', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<UncheckedIcon> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class UncheckedIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UncheckedIcon",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    function createBackgroundColor(
      pos,
      checkedPos,
      uncheckedPos,
      offColor,
      onColor
    ) {
      const relativePos = (pos - uncheckedPos) / (checkedPos - uncheckedPos);
      if (relativePos === 0) {
        return offColor;
      }
      if (relativePos === 1) {
        return onColor;
      }

      let newColor = "#";
      for (let i = 1; i < 6; i += 2) {
        const offComponent = parseInt(offColor.substr(i, 2), 16);
        const onComponent = parseInt(onColor.substr(i, 2), 16);
        const weightedValue = Math.round(
          (1 - relativePos) * offComponent + relativePos * onComponent
        );
        let newComponent = weightedValue.toString(16);
        if (newComponent.length === 1) {
          newComponent = `0${newComponent}`;
        }
        newColor += newComponent;
      }
      return newColor;
    }

    function convertShorthandColor(color) {
      if (color.length === 7) {
        return color;
      }
      let sixDigitColor = "#";
      for (let i = 1; i < 4; i += 1) {
        sixDigitColor += color[i] + color[i];
      }
      return sixDigitColor;
    }

    function getBackgroundColor(
      pos,
      checkedPos,
      uncheckedPos,
      offColor,
      onColor
    ) {
      const sixDigitOffColor = convertShorthandColor(offColor);
      const sixDigitOnColor = convertShorthandColor(onColor);
      return createBackgroundColor(
        pos,
        checkedPos,
        uncheckedPos,
        sixDigitOffColor,
        sixDigitOnColor
      );
    }

    /* node_modules\svelte-switch\src\components\Switch.svelte generated by Svelte v3.42.1 */
    const file$6 = "node_modules\\svelte-switch\\src\\components\\Switch.svelte";
    const get_unCheckedIcon_slot_changes = dirty => ({});
    const get_unCheckedIcon_slot_context = ctx => ({});
    const get_checkedIcon_slot_changes = dirty => ({});
    const get_checkedIcon_slot_context = ctx => ({});

    // (313:31)           
    function fallback_block_1(ctx) {
    	let cicon;
    	let current;
    	cicon = new /*CIcon*/ ctx[18]({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(cicon.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(cicon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(cicon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block_1.name,
    		type: "fallback",
    		source: "(313:31)           ",
    		ctx
    	});

    	return block;
    }

    // (318:33)           
    function fallback_block(ctx) {
    	let uicon;
    	let current;
    	uicon = new /*UIcon*/ ctx[19]({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(uicon.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(uicon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(uicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(uicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(uicon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block.name,
    		type: "fallback",
    		source: "(318:33)           ",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div4;
    	let div2;
    	let div0;
    	let t0;
    	let div1;
    	let div2_onmousedown_value;
    	let t1;
    	let div3;
    	let t2;
    	let input;
    	let current;
    	let mounted;
    	let dispose;
    	const checkedIcon_slot_template = /*#slots*/ ctx[35].checkedIcon;
    	const checkedIcon_slot = create_slot(checkedIcon_slot_template, ctx, /*$$scope*/ ctx[34], get_checkedIcon_slot_context);
    	const checkedIcon_slot_or_fallback = checkedIcon_slot || fallback_block_1(ctx);
    	const unCheckedIcon_slot_template = /*#slots*/ ctx[35].unCheckedIcon;
    	const unCheckedIcon_slot = create_slot(unCheckedIcon_slot_template, ctx, /*$$scope*/ ctx[34], get_unCheckedIcon_slot_context);
    	const unCheckedIcon_slot_or_fallback = unCheckedIcon_slot || fallback_block(ctx);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			if (checkedIcon_slot_or_fallback) checkedIcon_slot_or_fallback.c();
    			t0 = space();
    			div1 = element("div");
    			if (unCheckedIcon_slot_or_fallback) unCheckedIcon_slot_or_fallback.c();
    			t1 = space();
    			div3 = element("div");
    			t2 = space();
    			input = element("input");
    			attr_dev(div0, "style", /*checkedIconStyle*/ ctx[5]);
    			add_location(div0, file$6, 311, 4, 8377);
    			attr_dev(div1, "style", /*uncheckedIconStyle*/ ctx[6]);
    			add_location(div1, file$6, 316, 4, 8492);
    			attr_dev(div2, "class", "react-switch-bg");
    			attr_dev(div2, "style", /*backgroundStyle*/ ctx[4]);
    			attr_dev(div2, "onmousedown", div2_onmousedown_value = func);
    			add_location(div2, file$6, 306, 2, 8223);
    			attr_dev(div3, "class", "react-switch-handle");
    			attr_dev(div3, "style", /*handleStyle*/ ctx[7]);
    			add_location(div3, file$6, 322, 2, 8619);
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "role", "switch");
    			input.disabled = /*disabled*/ ctx[0];
    			attr_dev(input, "style", /*inputStyle*/ ctx[8]);
    			add_location(input, file$6, 331, 2, 8984);
    			attr_dev(div4, "class", /*containerClass*/ ctx[1]);
    			attr_dev(div4, "style", /*rootStyle*/ ctx[3]);
    			add_location(div4, file$6, 305, 0, 8173);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div2);
    			append_dev(div2, div0);

    			if (checkedIcon_slot_or_fallback) {
    				checkedIcon_slot_or_fallback.m(div0, null);
    			}

    			append_dev(div2, t0);
    			append_dev(div2, div1);

    			if (unCheckedIcon_slot_or_fallback) {
    				unCheckedIcon_slot_or_fallback.m(div1, null);
    			}

    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div4, t2);
    			append_dev(div4, input);
    			/*input_binding*/ ctx[36](input);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div2,
    						"click",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*onClick*/ ctx[17])) (/*disabled*/ ctx[0] ? null : /*onClick*/ ctx[17]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(div3, "click", click_handler, false, false, false),
    					listen_dev(
    						div3,
    						"mousedown",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*onMouseDown*/ ctx[9])) (/*disabled*/ ctx[0] ? null : /*onMouseDown*/ ctx[9]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div3,
    						"touchstart",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*onTouchStart*/ ctx[10])) (/*disabled*/ ctx[0] ? null : /*onTouchStart*/ ctx[10]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div3,
    						"touchmove",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*onTouchMove*/ ctx[11])) (/*disabled*/ ctx[0] ? null : /*onTouchMove*/ ctx[11]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div3,
    						"touchend",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*onTouchEnd*/ ctx[12])) (/*disabled*/ ctx[0] ? null : /*onTouchEnd*/ ctx[12]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div3,
    						"touchcancel",
    						function () {
    							if (is_function(/*disabled*/ ctx[0] ? null : /*unsetHasOutline*/ ctx[16])) (/*disabled*/ ctx[0] ? null : /*unsetHasOutline*/ ctx[16]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(input, "focus", /*setHasOutline*/ ctx[15], false, false, false),
    					listen_dev(input, "blur", /*unsetHasOutline*/ ctx[16], false, false, false),
    					listen_dev(input, "keyup", /*onKeyUp*/ ctx[14], false, false, false),
    					listen_dev(input, "change", /*onInputChange*/ ctx[13], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (checkedIcon_slot) {
    				if (checkedIcon_slot.p && (!current || dirty[1] & /*$$scope*/ 8)) {
    					update_slot_base(
    						checkedIcon_slot,
    						checkedIcon_slot_template,
    						ctx,
    						/*$$scope*/ ctx[34],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[34])
    						: get_slot_changes(checkedIcon_slot_template, /*$$scope*/ ctx[34], dirty, get_checkedIcon_slot_changes),
    						get_checkedIcon_slot_context
    					);
    				}
    			}

    			if (!current || dirty[0] & /*checkedIconStyle*/ 32) {
    				attr_dev(div0, "style", /*checkedIconStyle*/ ctx[5]);
    			}

    			if (unCheckedIcon_slot) {
    				if (unCheckedIcon_slot.p && (!current || dirty[1] & /*$$scope*/ 8)) {
    					update_slot_base(
    						unCheckedIcon_slot,
    						unCheckedIcon_slot_template,
    						ctx,
    						/*$$scope*/ ctx[34],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[34])
    						: get_slot_changes(unCheckedIcon_slot_template, /*$$scope*/ ctx[34], dirty, get_unCheckedIcon_slot_changes),
    						get_unCheckedIcon_slot_context
    					);
    				}
    			}

    			if (!current || dirty[0] & /*uncheckedIconStyle*/ 64) {
    				attr_dev(div1, "style", /*uncheckedIconStyle*/ ctx[6]);
    			}

    			if (!current || dirty[0] & /*backgroundStyle*/ 16) {
    				attr_dev(div2, "style", /*backgroundStyle*/ ctx[4]);
    			}

    			if (!current || dirty[0] & /*handleStyle*/ 128) {
    				attr_dev(div3, "style", /*handleStyle*/ ctx[7]);
    			}

    			if (!current || dirty[0] & /*disabled*/ 1) {
    				prop_dev(input, "disabled", /*disabled*/ ctx[0]);
    			}

    			if (!current || dirty[0] & /*inputStyle*/ 256) {
    				attr_dev(input, "style", /*inputStyle*/ ctx[8]);
    			}

    			if (!current || dirty[0] & /*containerClass*/ 2) {
    				attr_dev(div4, "class", /*containerClass*/ ctx[1]);
    			}

    			if (!current || dirty[0] & /*rootStyle*/ 8) {
    				attr_dev(div4, "style", /*rootStyle*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(checkedIcon_slot_or_fallback, local);
    			transition_in(unCheckedIcon_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(checkedIcon_slot_or_fallback, local);
    			transition_out(unCheckedIcon_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			if (checkedIcon_slot_or_fallback) checkedIcon_slot_or_fallback.d(detaching);
    			if (unCheckedIcon_slot_or_fallback) unCheckedIcon_slot_or_fallback.d(detaching);
    			/*input_binding*/ ctx[36](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = e => e.preventDefault();
    const click_handler = e => e.preventDefault();

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Switch', slots, ['checkedIcon','unCheckedIcon']);
    	let { checked } = $$props;
    	let { disabled = false } = $$props;
    	let { offColor = "#888" } = $$props;
    	let { onColor = "#080" } = $$props;
    	let { offHandleColor = "#fff" } = $$props;
    	let { onHandleColor = "#fff" } = $$props;
    	let { handleDiameter } = $$props;
    	let { unCheckedIcon = UncheckedIcon } = $$props;
    	let { checkedIcon = CheckedIcon } = $$props;
    	let { boxShadow = null } = $$props;
    	let { activeBoxShadow = "0 0 2px 3px #3bf" } = $$props;
    	let { height = 28 } = $$props;
    	let { width = 56 } = $$props;
    	let { id = "" } = $$props;
    	let { containerClass = "" } = $$props;
    	const dispatch = createEventDispatcher();

    	//state
    	let state = {
    		handleDiameter: 0,
    		checkedPos: 0,
    		uncheckedPos: 0,
    		pos: 0,
    		lastDragAt: 0,
    		lastKeyUpAt: 0,
    		startX: null,
    		hasOutline: null,
    		dragStartingTime: null,
    		checkedStateFromDragging: false
    	};

    	let inputRef = null;
    	state.handleDiameter = handleDiameter || height - 2;
    	state.checkedPos = Math.max(width - height, width - (height + state.handleDiameter) / 2);
    	state.uncheckedPos = Math.max(0, (height - state.handleDiameter) / 2);
    	state.pos = checked ? state.checkedPos : state.uncheckedPos;
    	state.lastDragAt = 0;
    	state.lastKeyUpAt = 0;

    	//event handlers
    	function onDragStart(clientX) {
    		inputRef && inputRef.focus && inputRef.focus();
    		$$invalidate(33, state.startX = clientX, state);
    		$$invalidate(33, state.hasOutline = true, state);
    		$$invalidate(33, state.dragStartingTime = Date.now(), state);
    	}

    	function onDrag(clientX) {
    		let { startX, isDragging, pos } = state;
    		const startPos = checked ? state.checkedPos : state.uncheckedPos;
    		const mousePos = startPos + clientX - startX;

    		// We need this check to fix a windows glitch where onDrag is triggered onMouseDown in some cases
    		if (!isDragging && clientX !== startX) {
    			$$invalidate(33, state.isDragging = true, state);
    		}

    		const newPos = Math.min(state.checkedPos, Math.max(state.uncheckedPos, mousePos));

    		// Prevent unnecessary rerenders
    		if (newPos !== pos) {
    			$$invalidate(33, state.pos = newPos, state);
    		}
    	}

    	function onDragStop(event) {
    		let { pos, isDragging, dragStartingTime } = state;
    		const halfwayCheckpoint = (state.checkedPos + state.uncheckedPos) / 2;

    		// Simulate clicking the handle
    		const timeSinceStart = Date.now() - dragStartingTime;

    		if (!isDragging || timeSinceStart < 250) {
    			onChangeTrigger(event);
    		} else if (checked) {
    			if (pos > halfwayCheckpoint) {
    				$$invalidate(33, state.pos = state.checkedPos, state); // Handle dragging from checked position
    			} else {
    				onChangeTrigger(event);
    			}
    		} else if (pos < halfwayCheckpoint) {
    			$$invalidate(33, state.pos = state.uncheckedPos, state); // Handle dragging from unchecked position
    		} else {
    			onChangeTrigger(event);
    		}

    		$$invalidate(33, state.isDragging = false, state);
    		$$invalidate(33, state.hasOutline = false, state);
    		$$invalidate(33, state.lastDragAt = Date.now(), state);
    	}

    	function onMouseDown(event) {
    		event.preventDefault();

    		// Ignore right click and scroll
    		if (typeof event.button === "number" && event.button !== 0) {
    			return;
    		}

    		onDragStart(event.clientX);
    		window.addEventListener("mousemove", onMouseMove);
    		window.addEventListener("mouseup", onMouseUp);
    	}

    	function onMouseMove(event) {
    		event.preventDefault();
    		onDrag(event.clientX);
    	}

    	function onMouseUp(event) {
    		onDragStop(event);
    		window.removeEventListener("mousemove", onMouseMove);
    		window.removeEventListener("mouseup", onMouseUp);
    	}

    	function onTouchStart(event) {
    		$$invalidate(33, state.checkedStateFromDragging = null, state);
    		onDragStart(event.touches[0].clientX);
    	}

    	function onTouchMove(event) {
    		onDrag(event.touches[0].clientX);
    	}

    	function onTouchEnd(event) {
    		event.preventDefault();
    		onDragStop(event);
    	}

    	function onInputChange(event) {
    		// This condition is unfortunately needed in some browsers where the input's change event might get triggered
    		// right after the dragstop event is triggered (occurs when dropping over a label element)
    		if (Date.now() - state.lastDragAt > 50) {
    			onChangeTrigger(event);

    			// Prevent clicking label, but not key activation from setting outline to true - yes, this is absurd
    			if (Date.now() - state.lastKeyUpAt > 50) {
    				$$invalidate(33, state.hasOutline = false, state);
    			}
    		}
    	}

    	function onKeyUp() {
    		$$invalidate(33, state.lastKeyUpAt = Date.now(), state);
    	}

    	function setHasOutline() {
    		$$invalidate(33, state.hasOutline = true, state);
    	}

    	function unsetHasOutline() {
    		$$invalidate(33, state.hasOutline = false, state);
    	}

    	function onClick(event) {
    		event.preventDefault();
    		inputRef.focus();
    		onChangeTrigger(event);
    		$$invalidate(33, state.hasOutline = false, state);
    	}

    	function onChangeTrigger(event) {
    		$$invalidate(20, checked = !checked);
    		dispatch("change", { checked, event, id });
    	}

    	//Hack since components should always to starting with Capital letter and props are camelCasing
    	let CIcon = checkedIcon;

    	let UIcon = unCheckedIcon;

    	//styles
    	let rootStyle = "";

    	let backgroundStyle = "";
    	let checkedIconStyle = "";
    	let uncheckedIconStyle = "";
    	let handleStyle = "";
    	let inputStyle = "";

    	const writable_props = [
    		'checked',
    		'disabled',
    		'offColor',
    		'onColor',
    		'offHandleColor',
    		'onHandleColor',
    		'handleDiameter',
    		'unCheckedIcon',
    		'checkedIcon',
    		'boxShadow',
    		'activeBoxShadow',
    		'height',
    		'width',
    		'id',
    		'containerClass'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Switch> was created with unknown prop '${key}'`);
    	});

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			inputRef = $$value;
    			$$invalidate(2, inputRef);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('checked' in $$props) $$invalidate(20, checked = $$props.checked);
    		if ('disabled' in $$props) $$invalidate(0, disabled = $$props.disabled);
    		if ('offColor' in $$props) $$invalidate(21, offColor = $$props.offColor);
    		if ('onColor' in $$props) $$invalidate(22, onColor = $$props.onColor);
    		if ('offHandleColor' in $$props) $$invalidate(23, offHandleColor = $$props.offHandleColor);
    		if ('onHandleColor' in $$props) $$invalidate(24, onHandleColor = $$props.onHandleColor);
    		if ('handleDiameter' in $$props) $$invalidate(25, handleDiameter = $$props.handleDiameter);
    		if ('unCheckedIcon' in $$props) $$invalidate(26, unCheckedIcon = $$props.unCheckedIcon);
    		if ('checkedIcon' in $$props) $$invalidate(27, checkedIcon = $$props.checkedIcon);
    		if ('boxShadow' in $$props) $$invalidate(28, boxShadow = $$props.boxShadow);
    		if ('activeBoxShadow' in $$props) $$invalidate(29, activeBoxShadow = $$props.activeBoxShadow);
    		if ('height' in $$props) $$invalidate(30, height = $$props.height);
    		if ('width' in $$props) $$invalidate(31, width = $$props.width);
    		if ('id' in $$props) $$invalidate(32, id = $$props.id);
    		if ('containerClass' in $$props) $$invalidate(1, containerClass = $$props.containerClass);
    		if ('$$scope' in $$props) $$invalidate(34, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		createEventDispatcher,
    		defaultCheckedIcon: CheckedIcon,
    		defaultUncheckedIcon: UncheckedIcon,
    		getBackgroundColor,
    		checked,
    		disabled,
    		offColor,
    		onColor,
    		offHandleColor,
    		onHandleColor,
    		handleDiameter,
    		unCheckedIcon,
    		checkedIcon,
    		boxShadow,
    		activeBoxShadow,
    		height,
    		width,
    		id,
    		containerClass,
    		dispatch,
    		state,
    		inputRef,
    		onDragStart,
    		onDrag,
    		onDragStop,
    		onMouseDown,
    		onMouseMove,
    		onMouseUp,
    		onTouchStart,
    		onTouchMove,
    		onTouchEnd,
    		onInputChange,
    		onKeyUp,
    		setHasOutline,
    		unsetHasOutline,
    		onClick,
    		onChangeTrigger,
    		CIcon,
    		UIcon,
    		rootStyle,
    		backgroundStyle,
    		checkedIconStyle,
    		uncheckedIconStyle,
    		handleStyle,
    		inputStyle
    	});

    	$$self.$inject_state = $$props => {
    		if ('checked' in $$props) $$invalidate(20, checked = $$props.checked);
    		if ('disabled' in $$props) $$invalidate(0, disabled = $$props.disabled);
    		if ('offColor' in $$props) $$invalidate(21, offColor = $$props.offColor);
    		if ('onColor' in $$props) $$invalidate(22, onColor = $$props.onColor);
    		if ('offHandleColor' in $$props) $$invalidate(23, offHandleColor = $$props.offHandleColor);
    		if ('onHandleColor' in $$props) $$invalidate(24, onHandleColor = $$props.onHandleColor);
    		if ('handleDiameter' in $$props) $$invalidate(25, handleDiameter = $$props.handleDiameter);
    		if ('unCheckedIcon' in $$props) $$invalidate(26, unCheckedIcon = $$props.unCheckedIcon);
    		if ('checkedIcon' in $$props) $$invalidate(27, checkedIcon = $$props.checkedIcon);
    		if ('boxShadow' in $$props) $$invalidate(28, boxShadow = $$props.boxShadow);
    		if ('activeBoxShadow' in $$props) $$invalidate(29, activeBoxShadow = $$props.activeBoxShadow);
    		if ('height' in $$props) $$invalidate(30, height = $$props.height);
    		if ('width' in $$props) $$invalidate(31, width = $$props.width);
    		if ('id' in $$props) $$invalidate(32, id = $$props.id);
    		if ('containerClass' in $$props) $$invalidate(1, containerClass = $$props.containerClass);
    		if ('state' in $$props) $$invalidate(33, state = $$props.state);
    		if ('inputRef' in $$props) $$invalidate(2, inputRef = $$props.inputRef);
    		if ('CIcon' in $$props) $$invalidate(18, CIcon = $$props.CIcon);
    		if ('UIcon' in $$props) $$invalidate(19, UIcon = $$props.UIcon);
    		if ('rootStyle' in $$props) $$invalidate(3, rootStyle = $$props.rootStyle);
    		if ('backgroundStyle' in $$props) $$invalidate(4, backgroundStyle = $$props.backgroundStyle);
    		if ('checkedIconStyle' in $$props) $$invalidate(5, checkedIconStyle = $$props.checkedIconStyle);
    		if ('uncheckedIconStyle' in $$props) $$invalidate(6, uncheckedIconStyle = $$props.uncheckedIconStyle);
    		if ('handleStyle' in $$props) $$invalidate(7, handleStyle = $$props.handleStyle);
    		if ('inputStyle' in $$props) $$invalidate(8, inputStyle = $$props.inputStyle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*checked*/ 1048576 | $$self.$$.dirty[1] & /*state*/ 4) {
    			 if (!state.isDragging) {
    				$$invalidate(33, state.pos = checked ? state.checkedPos : state.uncheckedPos, state);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*disabled, height*/ 1073741825) {
    			 $$invalidate(3, rootStyle = `
    position: relative;
    display: inline-block;
    text-align: left;
    opacity: ${disabled ? 0.5 : 1};
    direction: ltr;
    border-radius: ${height / 2}px;
    transition: opacity 0.25s;
    touch-action: none;
    webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
  `);
    		}

    		if ($$self.$$.dirty[0] & /*height, offColor, onColor, disabled*/ 1080033281 | $$self.$$.dirty[1] & /*width, state*/ 5) {
    			 $$invalidate(4, backgroundStyle = `
    height: ${height}px;
    width: ${width}px;
    margin: ${Math.max(0, (state.handleDiameter - height) / 2)}px;
    position: relative;
    background: ${getBackgroundColor(state.pos, state.checkedPos, state.uncheckedPos, offColor, onColor)};
    border-radius: ${height / 2}px;
    cursor: ${disabled ? "default" : "pointer"};
    transition: ${state.isDragging ? null : "background 0.25s"};
  `);
    		}

    		if ($$self.$$.dirty[0] & /*height*/ 1073741824 | $$self.$$.dirty[1] & /*width, state*/ 5) {
    			 $$invalidate(5, checkedIconStyle = `
    height: ${height}px;
    width: ${Math.min(height * 1.5, width - (state.handleDiameter + height) / 2 + 1)}px;
    position: relative;
    opacity:
      ${(state.pos - state.uncheckedPos) / (state.checkedPos - state.uncheckedPos)};
    pointer-events: none;
    transition: ${state.isDragging ? null : "opacity 0.25s"};
  `);
    		}

    		if ($$self.$$.dirty[0] & /*height*/ 1073741824 | $$self.$$.dirty[1] & /*width, state*/ 5) {
    			 $$invalidate(6, uncheckedIconStyle = `
    height: ${height}px;
    width: ${Math.min(height * 1.5, width - (state.handleDiameter + height) / 2 + 1)}px;
    position: absolute;
    opacity:
      ${1 - (state.pos - state.uncheckedPos) / (state.checkedPos - state.uncheckedPos)};
    right: 0px;
    top: 0px;
    pointer-events: none;
    transition: ${state.isDragging ? null : "opacity 0.25s"};
  `);
    		}

    		if ($$self.$$.dirty[0] & /*offHandleColor, onHandleColor, disabled, height, activeBoxShadow, boxShadow*/ 1904214017 | $$self.$$.dirty[1] & /*state*/ 4) {
    			 $$invalidate(7, handleStyle = `
    height: ${state.handleDiameter}px;
    width: ${state.handleDiameter}px;
    background: ${getBackgroundColor(state.pos, state.checkedPos, state.uncheckedPos, offHandleColor, onHandleColor)};
    display: inline-block;
    cursor: ${disabled ? "default" : "pointer"};
    border-radius: 50%;
    position: absolute;
    transform: translateX(${state.pos}px);
    top: ${Math.max(0, (height - state.handleDiameter) / 2)}px;
    outline: 0;
    box-shadow: ${state.hasOutline ? activeBoxShadow : boxShadow};
    border: 0;
    transition: ${state.isDragging
			? null
			: "background-color 0.25s, transform 0.25s, box-shadow 0.15s"};
  `);
    		}
    	};

    	 $$invalidate(8, inputStyle = `
    border: 0px;
    clip: rect(0 0 0 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0px;
    position: absolute;
    width: 1px;
  `);

    	return [
    		disabled,
    		containerClass,
    		inputRef,
    		rootStyle,
    		backgroundStyle,
    		checkedIconStyle,
    		uncheckedIconStyle,
    		handleStyle,
    		inputStyle,
    		onMouseDown,
    		onTouchStart,
    		onTouchMove,
    		onTouchEnd,
    		onInputChange,
    		onKeyUp,
    		setHasOutline,
    		unsetHasOutline,
    		onClick,
    		CIcon,
    		UIcon,
    		checked,
    		offColor,
    		onColor,
    		offHandleColor,
    		onHandleColor,
    		handleDiameter,
    		unCheckedIcon,
    		checkedIcon,
    		boxShadow,
    		activeBoxShadow,
    		height,
    		width,
    		id,
    		state,
    		$$scope,
    		slots,
    		input_binding
    	];
    }

    class Switch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$6,
    			create_fragment$6,
    			safe_not_equal,
    			{
    				checked: 20,
    				disabled: 0,
    				offColor: 21,
    				onColor: 22,
    				offHandleColor: 23,
    				onHandleColor: 24,
    				handleDiameter: 25,
    				unCheckedIcon: 26,
    				checkedIcon: 27,
    				boxShadow: 28,
    				activeBoxShadow: 29,
    				height: 30,
    				width: 31,
    				id: 32,
    				containerClass: 1
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Switch",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*checked*/ ctx[20] === undefined && !('checked' in props)) {
    			console.warn("<Switch> was created without expected prop 'checked'");
    		}

    		if (/*handleDiameter*/ ctx[25] === undefined && !('handleDiameter' in props)) {
    			console.warn("<Switch> was created without expected prop 'handleDiameter'");
    		}
    	}

    	get checked() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checked(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get offColor() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set offColor(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onColor() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onColor(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get offHandleColor() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set offHandleColor(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onHandleColor() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onHandleColor(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get handleDiameter() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set handleDiameter(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get unCheckedIcon() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set unCheckedIcon(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checkedIcon() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checkedIcon(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get boxShadow() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set boxShadow(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activeBoxShadow() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activeBoxShadow(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get containerClass() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set containerClass(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Switch.svelte generated by Svelte v3.42.1 */

    function create_fragment$7(ctx) {
    	let switch_1;
    	let current;

    	switch_1 = new Switch({
    			props: {
    				checked: /*checkedValue*/ ctx[0],
    				height: 20,
    				width: 40,
    				handleDiameter: 0
    			},
    			$$inline: true
    		});

    	switch_1.$on("change", /*handleChange*/ ctx[1]);

    	const block = {
    		c: function create() {
    			create_component(switch_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(switch_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const switch_1_changes = {};
    			if (dirty & /*checkedValue*/ 1) switch_1_changes.checked = /*checkedValue*/ ctx[0];
    			switch_1.$set(switch_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(switch_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(switch_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(switch_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Switch', slots, []);
    	const dispatch = createEventDispatcher();
    	let { checkedValue = false } = $$props;

    	function handleChange(e) {
    		const { checked } = e.detail;
    		$$invalidate(0, checkedValue = checked);
    		dispatch("switch", { checked });
    	}

    	const writable_props = ['checkedValue'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Switch> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('checkedValue' in $$props) $$invalidate(0, checkedValue = $$props.checkedValue);
    	};

    	$$self.$capture_state = () => ({
    		Switch,
    		createEventDispatcher,
    		dispatch,
    		checkedValue,
    		handleChange
    	});

    	$$self.$inject_state = $$props => {
    		if ('checkedValue' in $$props) $$invalidate(0, checkedValue = $$props.checkedValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checkedValue, handleChange];
    }

    class Switch_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { checkedValue: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Switch_1",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get checkedValue() {
    		throw new Error("<Switch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checkedValue(value) {
    		throw new Error("<Switch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Input.svelte generated by Svelte v3.42.1 */

    const file$7 = "src\\components\\Input.svelte";

    function create_fragment$8(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[0]);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "svelte-17tmak1");
    			add_location(input, file$7, 4, 0, 50);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*change_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*placeholder*/ 1) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Input', slots, []);
    	let { placeholder } = $$props;
    	const writable_props = ['placeholder'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Input> was created with unknown prop '${key}'`);
    	});

    	function change_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('placeholder' in $$props) $$invalidate(0, placeholder = $$props.placeholder);
    	};

    	$$self.$capture_state = () => ({ placeholder });

    	$$self.$inject_state = $$props => {
    		if ('placeholder' in $$props) $$invalidate(0, placeholder = $$props.placeholder);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [placeholder, change_handler];
    }

    class Input extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { placeholder: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Input",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*placeholder*/ ctx[0] === undefined && !('placeholder' in props)) {
    			console.warn("<Input> was created without expected prop 'placeholder'");
    		}
    	}

    	get placeholder() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const stores = [];

    const createStore = (key, fallback) => {
      const storedValue = localStorage.getItem(key);
      let initialValue = storedValue;

      if (storedValue === null || storedValue === undefined) {
        initialValue = fallback;
      }

      if (storedValue === "true" || storedValue === "false") {
        initialValue = storedValue === "true";
      }

      const value = writable(initialValue);

      value.subscribe((val) => {
        if (typeof val === "object") {
          val = JSON.stringify(val);
        }

        localStorage.setItem(key, val);
      });

      stores.push({
        value,
        key,
      });

      return value;
    };

    const getStore = (key) => {
      const value = stores.find((store) => store.key === key).value;

      return value;
    };

    /* src\components\Settings.svelte generated by Svelte v3.42.1 */
    const file$8 = "src\\components\\Settings.svelte";

    // (48:2) {#if open}
    function create_if_block$1(ctx) {
    	let div6;
    	let div1;
    	let p0;
    	let t1;
    	let div0;
    	let ioiosclose;
    	let t2;
    	let div5;
    	let div2;
    	let p1;
    	let t4;
    	let input;
    	let t5;
    	let div3;
    	let p2;
    	let t7;
    	let switch0;
    	let t8;
    	let div4;
    	let p3;
    	let t10;
    	let switch1;
    	let t11;
    	let div7;
    	let current;
    	let mounted;
    	let dispose;
    	ioiosclose = new IoIosClose({ $$inline: true });

    	input = new Input({
    			props: { placeholder: /*$time*/ ctx[1] },
    			$$inline: true
    		});

    	input.$on("change", /*handleInput*/ ctx[8]("time", /*change_handler*/ ctx[9]));

    	switch0 = new Switch_1({
    			props: {
    				checkedValue: /*parsedSettings*/ ctx[4]["alarm"]
    			},
    			$$inline: true
    		});

    	switch0.$on("switch", /*handleSwitch*/ ctx[7]("alarm"));

    	switch1 = new Switch_1({
    			props: {
    				checkedValue: /*parsedSettings*/ ctx[4]["notification"]
    			},
    			$$inline: true
    		});

    	switch1.$on("switch", /*handleSwitch*/ ctx[7]("notification"));

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div1 = element("div");
    			p0 = element("p");
    			p0.textContent = "Settings";
    			t1 = space();
    			div0 = element("div");
    			create_component(ioiosclose.$$.fragment);
    			t2 = space();
    			div5 = element("div");
    			div2 = element("div");
    			p1 = element("p");
    			p1.textContent = "Time (minutes)";
    			t4 = space();
    			create_component(input.$$.fragment);
    			t5 = space();
    			div3 = element("div");
    			p2 = element("p");
    			p2.textContent = "Alarm sound";
    			t7 = space();
    			create_component(switch0.$$.fragment);
    			t8 = space();
    			div4 = element("div");
    			p3 = element("p");
    			p3.textContent = "Notification";
    			t10 = space();
    			create_component(switch1.$$.fragment);
    			t11 = space();
    			div7 = element("div");
    			attr_dev(p0, "class", "settings__header--title svelte-9zincx");
    			add_location(p0, file$8, 50, 8, 1164);
    			attr_dev(div0, "class", "settings__header--close svelte-9zincx");
    			add_location(div0, file$8, 51, 8, 1221);
    			attr_dev(div1, "class", "settings__header svelte-9zincx");
    			add_location(div1, file$8, 49, 6, 1124);
    			attr_dev(p1, "class", "settings__item--label svelte-9zincx");
    			add_location(p1, file$8, 57, 10, 1430);
    			attr_dev(div2, "class", "settings__item svelte-9zincx");
    			add_location(div2, file$8, 56, 8, 1390);
    			attr_dev(p2, "class", "settings__item--label svelte-9zincx");
    			add_location(p2, file$8, 65, 10, 1685);
    			attr_dev(div3, "class", "settings__item svelte-9zincx");
    			add_location(div3, file$8, 64, 8, 1645);
    			attr_dev(p3, "class", "settings__item--label svelte-9zincx");
    			add_location(p3, file$8, 73, 10, 1933);
    			attr_dev(div4, "class", "settings__item svelte-9zincx");
    			add_location(div4, file$8, 72, 8, 1893);
    			attr_dev(div5, "class", "settngs__content");
    			add_location(div5, file$8, 55, 6, 1350);
    			attr_dev(div6, "class", "settings__panel svelte-9zincx");
    			add_location(div6, file$8, 48, 4, 1087);
    			attr_dev(div7, "class", "settings_overlay svelte-9zincx");
    			add_location(div7, file$8, 82, 4, 2178);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div1);
    			append_dev(div1, p0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			mount_component(ioiosclose, div0, null);
    			append_dev(div6, t2);
    			append_dev(div6, div5);
    			append_dev(div5, div2);
    			append_dev(div2, p1);
    			append_dev(div2, t4);
    			mount_component(input, div2, null);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div3, p2);
    			append_dev(div3, t7);
    			mount_component(switch0, div3, null);
    			append_dev(div5, t8);
    			append_dev(div5, div4);
    			append_dev(div4, p3);
    			append_dev(div4, t10);
    			mount_component(switch1, div4, null);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, div7, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*handleCloseClick*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const input_changes = {};
    			if (dirty & /*$time*/ 2) input_changes.placeholder = /*$time*/ ctx[1];
    			input.$set(input_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ioiosclose.$$.fragment, local);
    			transition_in(input.$$.fragment, local);
    			transition_in(switch0.$$.fragment, local);
    			transition_in(switch1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ioiosclose.$$.fragment, local);
    			transition_out(input.$$.fragment, local);
    			transition_out(switch0.$$.fragment, local);
    			transition_out(switch1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(ioiosclose);
    			destroy_component(input);
    			destroy_component(switch0);
    			destroy_component(switch1);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div7);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(48:2) {#if open}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div1;
    	let div0;
    	let ioiossettings;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	ioiossettings = new IoIosSettings({ $$inline: true });
    	let if_block = /*open*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(ioiossettings.$$.fragment);
    			t = space();
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "settings__button svelte-9zincx");
    			add_location(div0, file$8, 43, 2, 973);
    			attr_dev(div1, "class", "settings svelte-9zincx");
    			add_location(div1, file$8, 42, 0, 947);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(ioiossettings, div0, null);
    			append_dev(div1, t);
    			if (if_block) if_block.m(div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*handleButtonClick*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*open*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*open*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ioiossettings.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ioiossettings.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(ioiossettings);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $settings;
    	let $time;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Settings', slots, []);
    	let open;
    	const time = getStore("time");
    	validate_store(time, 'time');
    	component_subscribe($$self, time, value => $$invalidate(1, $time = value));
    	const settings = getStore("settings");
    	validate_store(settings, 'settings');
    	component_subscribe($$self, settings, value => $$invalidate(10, $settings = value));
    	const parsedSettings = JSON.parse($settings);

    	const handleButtonClick = () => {
    		$$invalidate(0, open = true);
    	};

    	const handleCloseClick = () => {
    		$$invalidate(0, open = false);
    	};

    	const handleSwitch = key => ({ detail: { checked } }) => {
    		settings.update(old => {
    			const parsed = JSON.parse(old);
    			parsed[key] = checked;
    			return JSON.stringify(parsed);
    		});
    	};

    	const handleInput = (key, validation) => ({ target: { value } }) => {
    		if (!validation(value)) return;
    		time.set(value);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Settings> was created with unknown prop '${key}'`);
    	});

    	const change_handler = value => !isNaN(value);

    	$$self.$capture_state = () => ({
    		IoIosSettings,
    		IoIosClose,
    		Switch: Switch_1,
    		Input,
    		getStore,
    		open,
    		time,
    		settings,
    		parsedSettings,
    		handleButtonClick,
    		handleCloseClick,
    		handleSwitch,
    		handleInput,
    		$settings,
    		$time
    	});

    	$$self.$inject_state = $$props => {
    		if ('open' in $$props) $$invalidate(0, open = $$props.open);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		open,
    		$time,
    		time,
    		settings,
    		parsedSettings,
    		handleButtonClick,
    		handleCloseClick,
    		handleSwitch,
    		handleInput,
    		change_handler
    	];
    }

    class Settings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Settings",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.42.1 */

    const { console: console_1 } = globals;
    const file$9 = "src\\App.svelte";

    // (108:2) {#if isEnd}
    function create_if_block$2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Oi! It's time to drink waterrr.";
    			attr_dev(h1, "class", "notify-message svelte-6ynqnc");
    			add_location(h1, file$9, 108, 4, 2160);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(108:2) {#if isEnd}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let main;
    	let t0;
    	let div0;
    	let settings_1;
    	let t1;
    	let div3;
    	let div1;
    	let t2;
    	let div2;
    	let h1;
    	let t4;
    	let p;
    	let t5;
    	let strong;
    	let t6_value = humanizeDuration(/*remainingTime*/ ctx[0]) + "";
    	let t6;
    	let t7;
    	let div4;
    	let button0;
    	let t8;
    	let button1;
    	let main_style_value;
    	let current;
    	let if_block = /*isEnd*/ ctx[3] && create_if_block$2(ctx);
    	settings_1 = new Settings({ $$inline: true });

    	button0 = new Button({
    			props: {
    				primary: true,
    				text: /*isPaused*/ ctx[2] && !/*isEnd*/ ctx[3]
    				? "Start"
    				: "Restart"
    			},
    			$$inline: true
    		});

    	button0.$on("click", /*handleStartClick*/ ctx[4]);

    	button1 = new Button({
    			props: { secondary: true, text: "Pause" },
    			$$inline: true
    		});

    	button1.$on("click", /*handlePauseClick*/ ctx[5]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			create_component(settings_1.$$.fragment);
    			t1 = space();
    			div3 = element("div");
    			div1 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Stay hydrated!";
    			t4 = space();
    			p = element("p");
    			t5 = text("Time left: ");
    			strong = element("strong");
    			t6 = text(t6_value);
    			t7 = space();
    			div4 = element("div");
    			create_component(button0.$$.fragment);
    			t8 = space();
    			create_component(button1.$$.fragment);
    			attr_dev(div0, "class", "settings-container svelte-6ynqnc");
    			add_location(div0, file$9, 111, 2, 2235);
    			attr_dev(div1, "class", "timer__background svelte-6ynqnc");
    			add_location(div1, file$9, 116, 4, 2321);
    			attr_dev(h1, "class", "timer__overlay--title text-lg text-gray-600 svelte-6ynqnc");
    			add_location(h1, file$9, 119, 6, 2395);
    			add_location(strong, file$9, 124, 19, 2546);
    			attr_dev(p, "class", "timer__overlay--time");
    			add_location(p, file$9, 123, 6, 2494);
    			attr_dev(div2, "class", "timer__overlay svelte-6ynqnc");
    			add_location(div2, file$9, 118, 4, 2360);
    			attr_dev(div3, "class", "timer svelte-6ynqnc");
    			add_location(div3, file$9, 115, 2, 2297);
    			attr_dev(div4, "class", "button-container svelte-6ynqnc");
    			add_location(div4, file$9, 131, 2, 2651);
    			attr_dev(main, "style", main_style_value = `--timer-background-percent: ${/*percent*/ ctx[1]}%`);
    			attr_dev(main, "class", "svelte-6ynqnc");
    			add_location(main, file$9, 106, 0, 2085);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if (if_block) if_block.m(main, null);
    			append_dev(main, t0);
    			append_dev(main, div0);
    			mount_component(settings_1, div0, null);
    			append_dev(main, t1);
    			append_dev(main, div3);
    			append_dev(div3, div1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, h1);
    			append_dev(div2, t4);
    			append_dev(div2, p);
    			append_dev(p, t5);
    			append_dev(p, strong);
    			append_dev(strong, t6);
    			append_dev(main, t7);
    			append_dev(main, div4);
    			mount_component(button0, div4, null);
    			append_dev(div4, t8);
    			mount_component(button1, div4, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*isEnd*/ ctx[3]) {
    				if (if_block) ; else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(main, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if ((!current || dirty & /*remainingTime*/ 1) && t6_value !== (t6_value = humanizeDuration(/*remainingTime*/ ctx[0]) + "")) set_data_dev(t6, t6_value);
    			const button0_changes = {};

    			if (dirty & /*isPaused, isEnd*/ 12) button0_changes.text = /*isPaused*/ ctx[2] && !/*isEnd*/ ctx[3]
    			? "Start"
    			: "Restart";

    			button0.$set(button0_changes);

    			if (!current || dirty & /*percent*/ 2 && main_style_value !== (main_style_value = `--timer-background-percent: ${/*percent*/ ctx[1]}%`)) {
    				attr_dev(main, "style", main_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(settings_1.$$.fragment, local);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(settings_1.$$.fragment, local);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			destroy_component(settings_1);
    			destroy_component(button0);
    			destroy_component(button1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const { ipcRenderer } = require("electron");

    	const sendNotification = () => {
    		console.log("SENDING NOTIFICATIOn");

    		ipcRenderer.send("notification", {
    			title: "Drink watahhhhh",
    			message: "Spend few minutes to drink your watah. Stay hydrated."
    		});
    	};

    	const minutesToMilliseconds = minutes => {
    		let minute = 60000;
    		let milliseconds = minutes * minute;
    		return milliseconds;
    	};

    	const timeStore = createStore("time", 30);
    	const settingsStore = createStore("settings", { alarm: true, notification: true });
    	let settings;
    	let milliseconds = minutesToMilliseconds(30);
    	let remainingTime = milliseconds;

    	timeStore.subscribe(value => {
    		milliseconds = minutesToMilliseconds(Number(value));
    		$$invalidate(0, remainingTime = milliseconds);
    	});

    	settingsStore.subscribe(val => {
    		settings = JSON.parse(val);
    	});

    	const alarm = new Audio("alarm.mp3");
    	let percent = 100;
    	let interval;
    	let isPaused = true;
    	let isEnd = false;

    	const restart = () => {
    		if (interval) {
    			clearInterval(interval);
    		}

    		$$invalidate(3, isEnd = false);
    		$$invalidate(2, isPaused = false);
    		$$invalidate(1, percent = 100);
    		$$invalidate(0, remainingTime = milliseconds);
    	};

    	const stop = () => {
    		if (settings.notification) {
    			sendNotification();
    		}

    		$$invalidate(1, percent = 0);
    		clearInterval(interval);
    		$$invalidate(2, isPaused = false);
    		$$invalidate(3, isEnd = true);

    		if (settings.alarm) {
    			alarm.play();
    		}
    	};

    	const handleStartClick = () => {
    		if (isEnd || !isPaused) {
    			restart();
    		}

    		$$invalidate(2, isPaused = false);

    		interval = setInterval(
    			() => {
    				$$invalidate(0, remainingTime -= 1000);
    				$$invalidate(1, percent = remainingTime / milliseconds * 100);

    				if (remainingTime === 0) {
    					stop();
    				}
    			},
    			1000
    		);
    	};

    	const handlePauseClick = () => {
    		clearInterval(interval);
    		$$invalidate(2, isPaused = true);
    		alarm.pause();
    		alarm.currentTime = 0;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		humanizeDuration,
    		Button,
    		Settings,
    		createStore,
    		ipcRenderer,
    		sendNotification,
    		minutesToMilliseconds,
    		timeStore,
    		settingsStore,
    		settings,
    		milliseconds,
    		remainingTime,
    		alarm,
    		percent,
    		interval,
    		isPaused,
    		isEnd,
    		restart,
    		stop,
    		handleStartClick,
    		handlePauseClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('settings' in $$props) settings = $$props.settings;
    		if ('milliseconds' in $$props) milliseconds = $$props.milliseconds;
    		if ('remainingTime' in $$props) $$invalidate(0, remainingTime = $$props.remainingTime);
    		if ('percent' in $$props) $$invalidate(1, percent = $$props.percent);
    		if ('interval' in $$props) interval = $$props.interval;
    		if ('isPaused' in $$props) $$invalidate(2, isPaused = $$props.isPaused);
    		if ('isEnd' in $$props) $$invalidate(3, isEnd = $$props.isEnd);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [remainingTime, percent, isPaused, isEnd, handleStartClick, handlePauseClick];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
