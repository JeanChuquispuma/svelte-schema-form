function noop() { }
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
function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
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
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_style(node, key, value, important) {
    if (value === null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
}
function select_option(select, value) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        if (option.__value === value) {
            option.selected = true;
            return;
        }
    }
    select.selectedIndex = -1; // no option should be selected
}

let current_component;
function set_current_component(component) {
    current_component = component;
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
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
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
    seen_callbacks.clear();
    set_current_component(saved_component);
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
    else if (callback) {
        callback();
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
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
        ctx: [],
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
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
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
        if (!is_function(callback)) {
            return noop;
        }
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

/* src\ArrayField.svelte generated by Svelte v3.55.1 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[8] = list[i];
	child_ctx[10] = i;
	return child_ctx;
}

// (28:4) {#each temp_value as value, key}
function create_each_block$1(ctx) {
	let div2;
	let div0;
	let schemaform;
	let t0;
	let div1;
	let button;
	let t1;
	let current;
	let mounted;
	let dispose;

	schemaform = new SchemaForm({
			props: {
				schema: /*value*/ ctx[8],
				configFormRow: /*configFieldRow*/ ctx[1],
				formData: /*formData*/ ctx[3],
				arrayData: /*arrayData*/ ctx[0],
				itsArray,
				keyArray: /*key*/ ctx[10]
			}
		});

	function click_handler() {
		return /*click_handler*/ ctx[7](/*key*/ ctx[10]);
	}

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			create_component(schemaform.$$.fragment);
			t0 = space();
			div1 = element("div");
			button = element("button");
			button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"></path></svg>`;
			t1 = space();
			attr(div0, "class", "col-md-11");
			attr(button, "class", "btn btn-outline-danger pb-2");
			attr(div1, "class", "col-md-1 mt-2 ml-md-0 ml-3");
			attr(div2, "class", "row");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			mount_component(schemaform, div0, null);
			append(div2, t0);
			append(div2, div1);
			append(div1, button);
			append(div2, t1);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const schemaform_changes = {};
			if (dirty & /*temp_value*/ 4) schemaform_changes.schema = /*value*/ ctx[8];
			if (dirty & /*configFieldRow*/ 2) schemaform_changes.configFormRow = /*configFieldRow*/ ctx[1];
			if (dirty & /*arrayData*/ 1) schemaform_changes.arrayData = /*arrayData*/ ctx[0];
			schemaform.$set(schemaform_changes);
		},
		i(local) {
			if (current) return;
			transition_in(schemaform.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(schemaform.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			destroy_component(schemaform);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment$1(ctx) {
	let div0;
	let t0;
	let div1;
	let button;
	let t2;
	let div2;
	let current;
	let mounted;
	let dispose;
	let each_value = /*temp_value*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			div1 = element("div");
			button = element("button");

			button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle-fill pb-1" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"></path></svg>
        Add Entry`;

			t2 = space();
			div2 = element("div");
			attr(div0, "class", "col-12 col-md-12 mb-2 mt-2");
			attr(button, "class", "btn btn-primary ml-5");
			attr(div1, "class", "row");
			attr(div2, "class", "col");
		},
		m(target, anchor) {
			insert(target, div0, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			insert(target, t0, anchor);
			insert(target, div1, anchor);
			append(div1, button);
			insert(target, t2, anchor);
			insert(target, div2, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", /*add*/ ctx[4]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*remove, temp_value, configFieldRow, formData, arrayData, itsArray*/ 47) {
				each_value = /*temp_value*/ ctx[2];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(t0);
			if (detaching) detach(div1);
			if (detaching) detach(t2);
			if (detaching) detach(div2);
			mounted = false;
			dispose();
		}
	};
}

let itsArray = true;

function instance$1($$self, $$props, $$invalidate) {
	let { contentArray } = $$props;
	let { configFieldRow } = $$props;
	let { arrayData = [] } = $$props;
	let formData = {};
	let temp_value = [contentArray];

	const add = () => {
		$$invalidate(2, temp_value = temp_value.concat(contentArray));
	};

	const remove = index => {
		temp_value.splice(index, 1);
		$$invalidate(2, temp_value);
		arrayData.splice(index, 1);
		$$invalidate(0, arrayData);
	};

	const click_handler = key => {
		remove(key);
	};

	$$self.$$set = $$props => {
		if ('contentArray' in $$props) $$invalidate(6, contentArray = $$props.contentArray);
		if ('configFieldRow' in $$props) $$invalidate(1, configFieldRow = $$props.configFieldRow);
		if ('arrayData' in $$props) $$invalidate(0, arrayData = $$props.arrayData);
	};

	return [
		arrayData,
		configFieldRow,
		temp_value,
		formData,
		add,
		remove,
		contentArray,
		click_handler
	];
}

class ArrayField extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			contentArray: 6,
			configFieldRow: 1,
			arrayData: 0
		});
	}
}

/* src\SchemaForm.svelte generated by Svelte v3.55.1 */

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i];
	child_ctx[26] = i;
	return child_ctx;
}

function get_each_context_5(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	child_ctx[29] = i;
	return child_ctx;
}

function get_each_context_4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	child_ctx[29] = i;
	return child_ctx;
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i];
	child_ctx[26] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	child_ctx[29] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	child_ctx[29] = i;
	return child_ctx;
}

// (161:8) {:else}
function create_else_block_1(ctx) {
	let div;
	let current;
	let each_value_3 = Object.entries(/*schema*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "row");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (dirty[0] & /*recordRow, setDisplayNone, schema, valUpdateArray, updateArrayData, arrayData, keyArray, configFieldRow*/ 237611) {
				each_value_3 = Object.entries(/*schema*/ ctx[1]);
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_3(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div, null);
					}
				}

				group_outros();

				for (i = each_value_3.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_3.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (116:8) {#if !itsArray}
function create_if_block(ctx) {
	let div0;
	let t0;
	let div2;
	let div1;
	let button0;
	let t1;
	let button0_class_value;
	let t2;
	let button1;
	let t3;
	let current;
	let mounted;
	let dispose;
	let each_value = Object.entries(/*schema*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			div2 = element("div");
			div1 = element("div");
			button0 = element("button");
			t1 = text(/*txtBack*/ ctx[7]);
			t2 = space();
			button1 = element("button");
			t3 = text(/*txtSubmit*/ ctx[6]);
			attr(div0, "class", "row");
			attr(button0, "class", button0_class_value = "btn btn-primary " + /*setDisplayNone*/ ctx[17](!/*displayBack*/ ctx[8]));
			attr(button1, "class", "btn btn-primary w-md align-self-end");
			set_style(button1, "margin-left", "auto");
			attr(div1, "class", "col d-flex");
			attr(div2, "class", "row mt-3 mr-3");
		},
		m(target, anchor) {
			insert(target, div0, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			insert(target, t0, anchor);
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, button0);
			append(button0, t1);
			append(div1, t2);
			append(div1, button1);
			append(button1, t3);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*back*/ ctx[11]),
					listen(button1, "click", /*submit*/ ctx[10])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*recordRow, setDisplayNone, schema, updateFormData, configFieldRow, mainArray*/ 159754) {
				each_value = Object.entries(/*schema*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (!current || dirty[0] & /*txtBack*/ 128) set_data(t1, /*txtBack*/ ctx[7]);

			if (!current || dirty[0] & /*displayBack*/ 256 && button0_class_value !== (button0_class_value = "btn btn-primary " + /*setDisplayNone*/ ctx[17](!/*displayBack*/ ctx[8]))) {
				attr(button0, "class", button0_class_value);
			}

			if (!current || dirty[0] & /*txtSubmit*/ 64) set_data(t3, /*txtSubmit*/ ctx[6]);
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(t0);
			if (detaching) detach(div2);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (164:12) {#if value[1]["type"] == "array"}
function create_if_block_12(ctx) {
	let div;
	let label;
	let t0_value = /*value*/ ctx[9][1]["label"] + "";
	let t0;
	let label_for_value;
	let div_class_value;
	let t1;
	let arrayfield;
	let current;

	arrayfield = new ArrayField({
			props: {
				contentArray: /*value*/ ctx[9][1]["contentArray"],
				configFieldRow: /*configFieldRow*/ ctx[3]
			}
		});

	return {
		c() {
			div = element("div");
			label = element("label");
			t0 = text(t0_value);
			t1 = space();
			create_component(arrayfield.$$.fragment);
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(label, "class", "col-sm-3 col-form-label");
			attr(div, "class", div_class_value = "col-12 " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]));
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label);
			append(label, t0);
			insert(target, t1, anchor);
			mount_component(arrayfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty[0] & /*schema*/ 2) && t0_value !== (t0_value = /*value*/ ctx[9][1]["label"] + "")) set_data(t0, t0_value);

			if (!current || dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}

			if (!current || dirty[0] & /*schema*/ 2 && div_class_value !== (div_class_value = "col-12 " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]))) {
				attr(div, "class", div_class_value);
			}

			const arrayfield_changes = {};
			if (dirty[0] & /*schema*/ 2) arrayfield_changes.contentArray = /*value*/ ctx[9][1]["contentArray"];
			if (dirty[0] & /*configFieldRow*/ 8) arrayfield_changes.configFieldRow = /*configFieldRow*/ ctx[3];
			arrayfield.$set(arrayfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(arrayfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(arrayfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching) detach(t1);
			destroy_component(arrayfield, detaching);
		}
	};
}

// (171:16) {#if value[1]["type"] != "array"}
function create_if_block_11(ctx) {
	let label;
	let t_value = /*value*/ ctx[9][1]["label"] + "";
	let t;
	let label_for_value;

	return {
		c() {
			label = element("label");
			t = text(t_value);
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(label, "class", "col-sm-3 col-form-label");
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema*/ 2 && t_value !== (t_value = /*value*/ ctx[9][1]["label"] + "")) set_data(t, t_value);

			if (dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}
		},
		d(detaching) {
			if (detaching) detach(label);
		}
	};
}

// (193:20) {:else}
function create_else_block_2(ctx) {
	let input;
	let input_type_value;
	let input_id_value;
	let input_placeholder_value;
	let input_value_value;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "type", input_type_value = /*value*/ ctx[9][1]["type"]);
			attr(input, "class", "form-control");
			attr(input, "id", input_id_value = /*value*/ ctx[9][0]);
			attr(input, "placeholder", input_placeholder_value = /*value*/ ctx[9][1]["placeholder"]);
			input.value = input_value_value = /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]);
		},
		m(target, anchor) {
			insert(target, input, anchor);

			if (!mounted) {
				dispose = listen(input, "input", function () {
					if (is_function(/*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]))) /*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && input_type_value !== (input_type_value = /*value*/ ctx[9][1]["type"])) {
				attr(input, "type", input_type_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_id_value !== (input_id_value = /*value*/ ctx[9][0])) {
				attr(input, "id", input_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_placeholder_value !== (input_placeholder_value = /*value*/ ctx[9][1]["placeholder"])) {
				attr(input, "placeholder", input_placeholder_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_value_value !== (input_value_value = /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0])) && input.value !== input_value_value) {
				input.value = input_value_value;
			}
		},
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			dispose();
		}
	};
}

// (191:58) 
function create_if_block_10(ctx) {
	let br;

	return {
		c() {
			br = element("br");
		},
		m(target, anchor) {
			insert(target, br, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(br);
		}
	};
}

// (184:58) 
function create_if_block_9(ctx) {
	let each_1_anchor;
	let each_value_5 = Object.entries(/*value*/ ctx[9][1]["data"]);
	let each_blocks = [];

	for (let i = 0; i < each_value_5.length; i += 1) {
		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema, arrayData, keyArray, updateArrayData*/ 32803) {
				each_value_5 = Object.entries(/*value*/ ctx[9][1]["data"]);
				let i;

				for (i = 0; i < each_value_5.length; i += 1) {
					const child_ctx = get_each_context_5(ctx, each_value_5, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_5(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_5.length;
			}
		},
		d(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (177:59) 
function create_if_block_8(ctx) {
	let select;
	let option;
	let select_id_value;
	let select_value_value;
	let mounted;
	let dispose;
	let each_value_4 = Object.entries(/*value*/ ctx[9][1]["data"]);
	let each_blocks = [];

	for (let i = 0; i < each_value_4.length; i += 1) {
		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
	}

	return {
		c() {
			select = element("select");
			option = element("option");
			option.textContent = "-- Select --";

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			option.__value = "";
			option.value = option.__value;
			attr(select, "class", "form-control");
			attr(select, "id", select_id_value = /*value*/ ctx[9][0]);
		},
		m(target, anchor) {
			insert(target, select, anchor);
			append(select, option);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			select_option(select, /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]));

			if (!mounted) {
				dispose = listen(select, "change", function () {
					if (is_function(/*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]))) /*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2) {
				each_value_4 = Object.entries(/*value*/ ctx[9][1]["data"]);
				let i;

				for (i = 0; i < each_value_4.length; i += 1) {
					const child_ctx = get_each_context_4(ctx, each_value_4, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_4.length;
			}

			if (dirty[0] & /*schema*/ 2 && select_id_value !== (select_id_value = /*value*/ ctx[9][0])) {
				attr(select, "id", select_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && select_value_value !== (select_value_value = /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]))) {
				select_option(select, /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]));
			}
		},
		d(detaching) {
			if (detaching) detach(select);
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

// (175:20) {#if value[1]["type"] == "textarea"}
function create_if_block_7(ctx) {
	let textarea;
	let textarea_id_value;
	let textarea_value_value;
	let mounted;
	let dispose;

	return {
		c() {
			textarea = element("textarea");
			attr(textarea, "class", "form-control");
			attr(textarea, "id", textarea_id_value = /*value*/ ctx[9][0]);
			attr(textarea, "rows", "3");
			textarea.value = textarea_value_value = /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]);
		},
		m(target, anchor) {
			insert(target, textarea, anchor);

			if (!mounted) {
				dispose = listen(textarea, "input", function () {
					if (is_function(/*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]))) /*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && textarea_id_value !== (textarea_id_value = /*value*/ ctx[9][0])) {
				attr(textarea, "id", textarea_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && textarea_value_value !== (textarea_value_value = /*valUpdateArray*/ ctx[16](/*value*/ ctx[9][0]))) {
				textarea.value = textarea_value_value;
			}
		},
		d(detaching) {
			if (detaching) detach(textarea);
			mounted = false;
			dispose();
		}
	};
}

// (185:24) {#each Object.entries(value[1]["data"]) as val, k}
function create_each_block_5(ctx) {
	let div;
	let input;
	let input_id_value;
	let input_name_value;
	let input_value_value;
	let input_checked_value;
	let t0;
	let label;
	let t1_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "";
	let t1;
	let label_for_value;
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			input = element("input");
			t0 = space();
			label = element("label");
			t1 = text(t1_value);
			t2 = space();
			attr(input, "type", "radio");
			attr(input, "id", input_id_value = /*val*/ ctx[27][0]);
			attr(input, "name", input_name_value = /*value*/ ctx[9][0]);
			input.value = input_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]];
			input.checked = input_checked_value = compareUpdateChecked(/*val*/ ctx[27][1]?.[/*value*/ ctx[9][1]?.["valueData"]], /*arrayData*/ ctx[0][/*keyArray*/ ctx[5]]?.[/*value*/ ctx[9][0]]);
			attr(label, "class", "form-check-label");
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(div, "class", "form-check form-check-inline");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, input);
			append(div, t0);
			append(div, label);
			append(label, t1);
			append(div, t2);

			if (!mounted) {
				dispose = listen(input, "change", function () {
					if (is_function(/*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]))) /*updateArrayData*/ ctx[15](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && input_id_value !== (input_id_value = /*val*/ ctx[27][0])) {
				attr(input, "id", input_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_name_value !== (input_name_value = /*value*/ ctx[9][0])) {
				attr(input, "name", input_name_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_value_value !== (input_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]])) {
				input.value = input_value_value;
			}

			if (dirty[0] & /*schema, arrayData, keyArray*/ 35 && input_checked_value !== (input_checked_value = compareUpdateChecked(/*val*/ ctx[27][1]?.[/*value*/ ctx[9][1]?.["valueData"]], /*arrayData*/ ctx[0][/*keyArray*/ ctx[5]]?.[/*value*/ ctx[9][0]]))) {
				input.checked = input_checked_value;
			}

			if (dirty[0] & /*schema*/ 2 && t1_value !== (t1_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "")) set_data(t1, t1_value);

			if (dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (180:28) {#each Object.entries(value[1]["data"]) as val, k}
function create_each_block_4(ctx) {
	let option;
	let t_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "";
	let t;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t = text(t_value);
			option.__value = option_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]];
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema*/ 2 && t_value !== (t_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "")) set_data(t, t_value);

			if (dirty[0] & /*schema*/ 2 && option_value_value !== (option_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]])) {
				option.__value = option_value_value;
				option.value = option.__value;
			}
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (163:12) {#each Object.entries(schema) as value, key}
function create_each_block_3(ctx) {
	let t0;
	let div1;
	let t1;
	let div0;
	let t2;
	let div1_class_value;
	let current;
	let if_block0 = /*value*/ ctx[9][1]["type"] == "array" && create_if_block_12(ctx);
	let if_block1 = /*value*/ ctx[9][1]["type"] != "array" && create_if_block_11(ctx);

	function select_block_type_2(ctx, dirty) {
		if (/*value*/ ctx[9][1]["type"] == "textarea") return create_if_block_7;
		if (/*value*/ ctx[9][1]["type"] == "select") return create_if_block_8;
		if (/*value*/ ctx[9][1]["type"] == "radio") return create_if_block_9;
		if (/*value*/ ctx[9][1]["type"] == "array") return create_if_block_10;
		return create_else_block_2;
	}

	let current_block_type = select_block_type_2(ctx);
	let if_block2 = current_block_type(ctx);

	return {
		c() {
			if (if_block0) if_block0.c();
			t0 = space();
			div1 = element("div");
			if (if_block1) if_block1.c();
			t1 = space();
			div0 = element("div");
			if_block2.c();
			t2 = space();
			attr(div0, "class", "col-12 col-sm-9");
			attr(div1, "class", div1_class_value = "col-12 col-md-" + /*recordRow*/ ctx[13](/*key*/ ctx[26]) + " " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]) + " mb-2 mt-2");
		},
		m(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert(target, t0, anchor);
			insert(target, div1, anchor);
			if (if_block1) if_block1.m(div1, null);
			append(div1, t1);
			append(div1, div0);
			if_block2.m(div0, null);
			append(div1, t2);
			current = true;
		},
		p(ctx, dirty) {
			if (/*value*/ ctx[9][1]["type"] == "array") {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty[0] & /*schema*/ 2) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_12(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(t0.parentNode, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (/*value*/ ctx[9][1]["type"] != "array") {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_11(ctx);
					if_block1.c();
					if_block1.m(div1, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block2) {
				if_block2.p(ctx, dirty);
			} else {
				if_block2.d(1);
				if_block2 = current_block_type(ctx);

				if (if_block2) {
					if_block2.c();
					if_block2.m(div0, null);
				}
			}

			if (!current || dirty[0] & /*schema*/ 2 && div1_class_value !== (div1_class_value = "col-12 col-md-" + /*recordRow*/ ctx[13](/*key*/ ctx[26]) + " " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]) + " mb-2 mt-2")) {
				attr(div1, "class", div1_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			current = true;
		},
		o(local) {
			transition_out(if_block0);
			current = false;
		},
		d(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach(t0);
			if (detaching) detach(div1);
			if (if_block1) if_block1.d();
			if_block2.d();
		}
	};
}

// (119:12) {#if value[1]["type"] == "array"}
function create_if_block_6(ctx) {
	let div;
	let label;
	let t0_value = /*value*/ ctx[9][1]["label"] + "";
	let t0;
	let label_for_value;
	let div_class_value;
	let t1;
	let arrayfield;
	let current;

	arrayfield = new ArrayField({
			props: {
				contentArray: /*value*/ ctx[9][1]["contentArray"],
				configFieldRow: /*configFieldRow*/ ctx[3],
				arrayData: /*mainArray*/ ctx[12][/*key*/ ctx[26]] = []
			}
		});

	return {
		c() {
			div = element("div");
			label = element("label");
			t0 = text(t0_value);
			t1 = space();
			create_component(arrayfield.$$.fragment);
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(label, "class", "col-sm-3 col-form-label");
			attr(div, "class", div_class_value = "col-12 " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]));
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label);
			append(label, t0);
			insert(target, t1, anchor);
			mount_component(arrayfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty[0] & /*schema*/ 2) && t0_value !== (t0_value = /*value*/ ctx[9][1]["label"] + "")) set_data(t0, t0_value);

			if (!current || dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}

			if (!current || dirty[0] & /*schema*/ 2 && div_class_value !== (div_class_value = "col-12 " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]))) {
				attr(div, "class", div_class_value);
			}

			const arrayfield_changes = {};
			if (dirty[0] & /*schema*/ 2) arrayfield_changes.contentArray = /*value*/ ctx[9][1]["contentArray"];
			if (dirty[0] & /*configFieldRow*/ 8) arrayfield_changes.configFieldRow = /*configFieldRow*/ ctx[3];
			arrayfield.$set(arrayfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(arrayfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(arrayfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching) detach(t1);
			destroy_component(arrayfield, detaching);
		}
	};
}

// (126:16) {#if value[1]["type"] != "array"}
function create_if_block_5(ctx) {
	let label;
	let t_value = /*value*/ ctx[9][1]["label"] + "";
	let t;
	let label_for_value;

	return {
		c() {
			label = element("label");
			t = text(t_value);
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(label, "class", "col-sm-3 col-form-label");
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema*/ 2 && t_value !== (t_value = /*value*/ ctx[9][1]["label"] + "")) set_data(t, t_value);

			if (dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}
		},
		d(detaching) {
			if (detaching) detach(label);
		}
	};
}

// (148:20) {:else}
function create_else_block(ctx) {
	let input;
	let input_type_value;
	let input_id_value;
	let input_placeholder_value;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "type", input_type_value = /*value*/ ctx[9][1]["type"]);
			attr(input, "class", "form-control");
			attr(input, "id", input_id_value = /*value*/ ctx[9][0]);
			attr(input, "placeholder", input_placeholder_value = /*value*/ ctx[9][1]["placeholder"]);
		},
		m(target, anchor) {
			insert(target, input, anchor);

			if (!mounted) {
				dispose = listen(input, "input", function () {
					if (is_function(/*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]))) /*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && input_type_value !== (input_type_value = /*value*/ ctx[9][1]["type"])) {
				attr(input, "type", input_type_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_id_value !== (input_id_value = /*value*/ ctx[9][0])) {
				attr(input, "id", input_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_placeholder_value !== (input_placeholder_value = /*value*/ ctx[9][1]["placeholder"])) {
				attr(input, "placeholder", input_placeholder_value);
			}
		},
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			dispose();
		}
	};
}

// (146:58) 
function create_if_block_4(ctx) {
	let br;

	return {
		c() {
			br = element("br");
		},
		m(target, anchor) {
			insert(target, br, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(br);
		}
	};
}

// (139:58) 
function create_if_block_3(ctx) {
	let each_1_anchor;
	let each_value_2 = Object.entries(/*value*/ ctx[9][1]["data"]);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema, updateFormData*/ 16386) {
				each_value_2 = Object.entries(/*value*/ ctx[9][1]["data"]);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}
		},
		d(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (132:59) 
function create_if_block_2(ctx) {
	let select;
	let option;
	let select_id_value;
	let mounted;
	let dispose;
	let each_value_1 = Object.entries(/*value*/ ctx[9][1]["data"]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			select = element("select");
			option = element("option");
			option.textContent = "-- Select --";

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			option.__value = "";
			option.value = option.__value;
			attr(select, "class", "form-control");
			attr(select, "id", select_id_value = /*value*/ ctx[9][0]);
		},
		m(target, anchor) {
			insert(target, select, anchor);
			append(select, option);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			if (!mounted) {
				dispose = listen(select, "change", function () {
					if (is_function(/*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]))) /*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2) {
				each_value_1 = Object.entries(/*value*/ ctx[9][1]["data"]);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (dirty[0] & /*schema*/ 2 && select_id_value !== (select_id_value = /*value*/ ctx[9][0])) {
				attr(select, "id", select_id_value);
			}
		},
		d(detaching) {
			if (detaching) detach(select);
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

// (130:20) {#if value[1]["type"] == "textarea"}
function create_if_block_1(ctx) {
	let textarea;
	let textarea_id_value;
	let mounted;
	let dispose;

	return {
		c() {
			textarea = element("textarea");
			attr(textarea, "class", "form-control");
			attr(textarea, "id", textarea_id_value = /*value*/ ctx[9][0]);
			attr(textarea, "rows", "3");
		},
		m(target, anchor) {
			insert(target, textarea, anchor);

			if (!mounted) {
				dispose = listen(textarea, "input", function () {
					if (is_function(/*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]))) /*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && textarea_id_value !== (textarea_id_value = /*value*/ ctx[9][0])) {
				attr(textarea, "id", textarea_id_value);
			}
		},
		d(detaching) {
			if (detaching) detach(textarea);
			mounted = false;
			dispose();
		}
	};
}

// (140:24) {#each Object.entries(value[1]["data"]) as val, k}
function create_each_block_2(ctx) {
	let div;
	let input;
	let input_id_value;
	let input_name_value;
	let input_value_value;
	let t0;
	let label;
	let t1_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "";
	let t1;
	let label_for_value;
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			input = element("input");
			t0 = space();
			label = element("label");
			t1 = text(t1_value);
			t2 = space();
			attr(input, "type", "radio");
			attr(input, "id", input_id_value = /*val*/ ctx[27][0]);
			attr(input, "name", input_name_value = /*value*/ ctx[9][0]);
			input.value = input_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]];
			attr(label, "class", "form-check-label");
			attr(label, "for", label_for_value = /*value*/ ctx[9][0]);
			attr(div, "class", "form-check form-check-inline");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, input);
			append(div, t0);
			append(div, label);
			append(label, t1);
			append(div, t2);

			if (!mounted) {
				dispose = listen(input, "change", function () {
					if (is_function(/*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]))) /*updateFormData*/ ctx[14](event, /*value*/ ctx[9][0]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*schema*/ 2 && input_id_value !== (input_id_value = /*val*/ ctx[27][0])) {
				attr(input, "id", input_id_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_name_value !== (input_name_value = /*value*/ ctx[9][0])) {
				attr(input, "name", input_name_value);
			}

			if (dirty[0] & /*schema*/ 2 && input_value_value !== (input_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]])) {
				input.value = input_value_value;
			}

			if (dirty[0] & /*schema*/ 2 && t1_value !== (t1_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "")) set_data(t1, t1_value);

			if (dirty[0] & /*schema*/ 2 && label_for_value !== (label_for_value = /*value*/ ctx[9][0])) {
				attr(label, "for", label_for_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (135:28) {#each Object.entries(value[1]["data"]) as val, k}
function create_each_block_1(ctx) {
	let option;
	let t_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "";
	let t;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t = text(t_value);
			option.__value = option_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]];
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*schema*/ 2 && t_value !== (t_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["textData"]] + "")) set_data(t, t_value);

			if (dirty[0] & /*schema*/ 2 && option_value_value !== (option_value_value = /*val*/ ctx[27][1][/*value*/ ctx[9][1]["valueData"]])) {
				option.__value = option_value_value;
				option.value = option.__value;
			}
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (118:12) {#each Object.entries(schema) as value, key}
function create_each_block(ctx) {
	let t0;
	let div1;
	let t1;
	let div0;
	let t2;
	let div1_class_value;
	let current;
	let if_block0 = /*value*/ ctx[9][1]["type"] == "array" && create_if_block_6(ctx);
	let if_block1 = /*value*/ ctx[9][1]["type"] != "array" && create_if_block_5(ctx);

	function select_block_type_1(ctx, dirty) {
		if (/*value*/ ctx[9][1]["type"] == "textarea") return create_if_block_1;
		if (/*value*/ ctx[9][1]["type"] == "select") return create_if_block_2;
		if (/*value*/ ctx[9][1]["type"] == "radio") return create_if_block_3;
		if (/*value*/ ctx[9][1]["type"] == "array") return create_if_block_4;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block2 = current_block_type(ctx);

	return {
		c() {
			if (if_block0) if_block0.c();
			t0 = space();
			div1 = element("div");
			if (if_block1) if_block1.c();
			t1 = space();
			div0 = element("div");
			if_block2.c();
			t2 = space();
			attr(div0, "class", "col-12 col-sm-9");
			attr(div1, "class", div1_class_value = "col-12 col-md-" + /*recordRow*/ ctx[13](/*key*/ ctx[26]) + " " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]) + " mb-2 mt-2");
		},
		m(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert(target, t0, anchor);
			insert(target, div1, anchor);
			if (if_block1) if_block1.m(div1, null);
			append(div1, t1);
			append(div1, div0);
			if_block2.m(div0, null);
			append(div1, t2);
			current = true;
		},
		p(ctx, dirty) {
			if (/*value*/ ctx[9][1]["type"] == "array") {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty[0] & /*schema*/ 2) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_6(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(t0.parentNode, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (/*value*/ ctx[9][1]["type"] != "array") {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_5(ctx);
					if_block1.c();
					if_block1.m(div1, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
				if_block2.p(ctx, dirty);
			} else {
				if_block2.d(1);
				if_block2 = current_block_type(ctx);

				if (if_block2) {
					if_block2.c();
					if_block2.m(div0, null);
				}
			}

			if (!current || dirty[0] & /*schema*/ 2 && div1_class_value !== (div1_class_value = "col-12 col-md-" + /*recordRow*/ ctx[13](/*key*/ ctx[26]) + " " + /*setDisplayNone*/ ctx[17](/*value*/ ctx[9][1]["hidden"]) + " mb-2 mt-2")) {
				attr(div1, "class", div1_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			current = true;
		},
		o(local) {
			transition_out(if_block0);
			current = false;
		},
		d(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach(t0);
			if (detaching) detach(div1);
			if (if_block1) if_block1.d();
			if_block2.d();
		}
	};
}

function create_fragment(ctx) {
	let div;
	let form;
	let current_block_type_index;
	let if_block;
	let current;
	const if_block_creators = [create_if_block, create_else_block_1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (!/*itsArray*/ ctx[4]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			div = element("div");
			form = element("form");
			if_block.c();
			attr(div, "class", /*classForm*/ ctx[2]);
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, form);
			if_blocks[current_block_type_index].m(form, null);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(form, null);
			}

			if (!current || dirty[0] & /*classForm*/ 4) {
				attr(div, "class", /*classForm*/ ctx[2]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if_blocks[current_block_type_index].d();
		}
	};
}

function compareUpdateChecked(val1, val2) {
	if (val1 == val2) {
		return true;
	} else {
		return false;
	}
}

function instance($$self, $$props, $$invalidate) {
	let { schema } = $$props;
	let { classForm } = $$props;
	let { configFormRow = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] } = $$props;
	let { configFieldRow = [3, 3, 3, 3] } = $$props;
	let { formData } = $$props;
	let { arrayData } = $$props;
	let { itsArray } = $$props;
	let { keyArray } = $$props;
	let { txtSubmit = "Submit" } = $$props;
	let { txtBack = "Back" } = $$props;
	let { displayBack = false } = $$props;
	let { onSubmit } = $$props;
	let { onBack } = $$props;

	const submit = () => {
		mainArray.forEach((value, index) => {
			console.log("el index es: " + index + " El valor es: ");
			console.log(value);
			console.log(Object.entries(schema)[index][0]);
			let indexTemp = Object.entries(schema)[index][0];
			$$invalidate(18, formData[indexTemp] = mainArray[index], formData);
		});

		onSubmit(formData);
	};

	const back = () => {
		onBack(formData);
	};

	let mainArray = [];
	let contRow = 0;
	let sumRow = 0;

	const recordRow = data => {
		//console.log(data)
		let ret = 12 / configFormRow[contRow];

		//console.log(data + ", " +contRow + "-> " + "12/" +configFormRow[contRow] + " : " + ret + " | "  + sumRow)
		if (data == sumRow) {
			return ret;
		} else if (data == sumRow + configFormRow[contRow] - 1) {
			sumRow += configFormRow[contRow];
			contRow += 1;
			return ret;
		} else {
			return ret;
		}
	};

	let value = '';

	const updateFormData = (event, key) => {
		$$invalidate(9, value = event.target.value);

		//console.log(value)
		//console.log(key)
		$$invalidate(18, formData[key] = value, formData);
	}; //console.log(formData)

	let valTemp = {};

	const updateArrayData = (event, key) => {
		//console.log("array")
		$$invalidate(9, value = event.target.value);

		//console.log(value)
		//console.log(key)
		valTemp[key] = value;

		//console.log(valTemp)
		$$invalidate(0, arrayData[keyArray] = valTemp, arrayData);
	};

	const valUpdateArray = value => {
		if (arrayData[keyArray]?.[value] != undefined && arrayData[keyArray]?.[value] != null && arrayData[keyArray]?.[value] != '') {
			return arrayData[keyArray][value];
		} else {
			return '';
		}
	};

	const setDisplayNone = val => {
		if (val == true) {
			return 'd-none';
		} else {
			return 'd-flex';
		}
	};

	$$self.$$set = $$props => {
		if ('schema' in $$props) $$invalidate(1, schema = $$props.schema);
		if ('classForm' in $$props) $$invalidate(2, classForm = $$props.classForm);
		if ('configFormRow' in $$props) $$invalidate(19, configFormRow = $$props.configFormRow);
		if ('configFieldRow' in $$props) $$invalidate(3, configFieldRow = $$props.configFieldRow);
		if ('formData' in $$props) $$invalidate(18, formData = $$props.formData);
		if ('arrayData' in $$props) $$invalidate(0, arrayData = $$props.arrayData);
		if ('itsArray' in $$props) $$invalidate(4, itsArray = $$props.itsArray);
		if ('keyArray' in $$props) $$invalidate(5, keyArray = $$props.keyArray);
		if ('txtSubmit' in $$props) $$invalidate(6, txtSubmit = $$props.txtSubmit);
		if ('txtBack' in $$props) $$invalidate(7, txtBack = $$props.txtBack);
		if ('displayBack' in $$props) $$invalidate(8, displayBack = $$props.displayBack);
		if ('onSubmit' in $$props) $$invalidate(20, onSubmit = $$props.onSubmit);
		if ('onBack' in $$props) $$invalidate(21, onBack = $$props.onBack);
	};

	return [
		arrayData,
		schema,
		classForm,
		configFieldRow,
		itsArray,
		keyArray,
		txtSubmit,
		txtBack,
		displayBack,
		value,
		submit,
		back,
		mainArray,
		recordRow,
		updateFormData,
		updateArrayData,
		valUpdateArray,
		setDisplayNone,
		formData,
		configFormRow,
		onSubmit,
		onBack
	];
}

class SchemaForm extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				schema: 1,
				classForm: 2,
				configFormRow: 19,
				configFieldRow: 3,
				formData: 18,
				arrayData: 0,
				itsArray: 4,
				keyArray: 5,
				txtSubmit: 6,
				txtBack: 7,
				displayBack: 8,
				onSubmit: 20,
				onBack: 21
			},
			null,
			[-1, -1]
		);
	}
}

export { SchemaForm };
