<script>
    import SchemaForm from "./SchemaForm.svelte"

    export let contentArray
    export let configFieldRow
    export let arrayData = []

    let formData = {}
    let itsArray = true
    

    let temp_value = [contentArray]

    const add = () => {
        temp_value = temp_value.concat(contentArray);
    }
    const remove = (index) => {
        temp_value.splice(index, 1)
        temp_value = temp_value

        arrayData.splice(index, 1)
        arrayData = arrayData
    }
    
</script>
<!--<button class="ml-5" on:click={() => {console.log(arrayData)}}> ver</button>-->
<div class="col-12 col-md-12 mb-2 mt-2">
    {#each temp_value as value, key}
    <div class="row">
        <div class="col-md-11">
            <SchemaForm schema={value} configFormRow={configFieldRow} formData={formData} arrayData={arrayData} {itsArray} keyArray={key}></SchemaForm>
        </div>
        <div class="col-md-1 mt-2 ml-md-0 ml-3">
            <button on:click={() => {remove(key)}} class="btn btn-outline-danger pb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16">
                    <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
                </svg>
            </button>
        </div>
    </div>
    {/each}
</div>
<div class="row">
    <button on:click={add} class="btn btn-primary ml-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle-fill pb-1" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"/>
        </svg>
        Add Entry
    </button>
</div>
<div class="col">
</div>
