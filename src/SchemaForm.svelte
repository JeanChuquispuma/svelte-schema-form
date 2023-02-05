<script>
    import ArrayField from "./ArrayField.svelte"

    export let schema
    export let classForm
    export let configFormRow = [2,2,2,2,2,2,2,2,2,2,2]
    export let configFieldRow = [3,3,3,3]
    export let formData

    export let arrayData
    export let itsArray
    export let keyArray

    export let txtSubmit = "Submit"
    export let txtBack = "Back"
    export let displayBack = false

    export let onSubmit
    export let onBack

    const submit = () => {
        mainArray.forEach((value, index)=>{
            console.log( "el index es: " + index + " El valor es: " )
            console.log(value )

            console.log(Object.entries(schema)[index][0])
            let indexTemp = Object.entries(schema)[index][0]
            formData[indexTemp] = mainArray[index]
        })
        onSubmit(formData)
    }

    const back = () => {
        onBack(formData)
    }

    let mainArray = []

    let contRow = 0
    let sumRow = 0
    let actRow = 0

    const recordRow = (data) => {
        //console.log(data)
        let ret = 12/configFormRow[contRow]
        //console.log(data + ", " +contRow + "-> " + "12/" +configFormRow[contRow] + " : " + ret + " | "  + sumRow)
        if(data == sumRow){
            return ret
        }else if (data == sumRow + configFormRow[contRow]-1){
            sumRow += configFormRow[contRow]
            contRow += 1
            return ret
        }else{
            return ret
        }        
    }

    let value = ''

    const updateFormData = (event, key) => {
        value = event.target.value
        //console.log(value)
        //console.log(key)
        formData[key] = value
        //console.log(formData)
    }

    let valTemp = {}

    const updateArrayData = (event, key) => {
        //console.log("array")
        value = event.target.value
        //console.log(value)
        //console.log(key)
        valTemp[key] = value
        //console.log(valTemp)

        arrayData[keyArray] = valTemp
    }

    const valUpdateArray = (value) =>{
        if(arrayData[keyArray]?.[value] != undefined && arrayData[keyArray]?.[value] != null && arrayData[keyArray]?.[value] != ''){
            return arrayData[keyArray][value]
        }else{
            return ''
        }
    }

    function compareUpdateChecked(val1, val2) {
        if(val1 == val2){
            return true
        }else{
            return false
        }
    }

    const setDisplayNone = (val) => {
        if(val == true){
            return 'd-none'
        }else{
            return 'd-flex'
        }
    }

</script>
<!--<div class="row">
    {#if itsArray}
        <button class="ml-5" on:click={() => {console.log(arrayData)}}> arrayData</button>
    {:else}
        <button class="ml-5" on:click={() => {console.log(formData)}}> formData</button>
        <button class="ml-5" on:click={() => {console.log(mainArray)}}> mainData</button>
    {/if}
</div>-->
<div class="{classForm}">
    <form>
        {#if !itsArray}
        <div class="row">
            {#each Object.entries(schema) as value, key}
            {#if value[1]["type"] == "array"}
            <div class="col-12 {setDisplayNone(value[1]["hidden"])}">
                <label for="{value[0]}" class="col-sm-3 col-form-label">{value[1]["label"]}</label>
            </div>
            <ArrayField contentArray={value[1]["contentArray"]} {configFieldRow} arrayData={mainArray[key]=[]}></ArrayField>
            {/if}
            <div class="col-12 col-md-{recordRow(key)} {setDisplayNone(value[1]["hidden"])} mb-2 mt-2">
                {#if value[1]["type"] != "array"}
                <label for="{value[0]}" class="col-sm-3 col-form-label">{value[1]["label"]}</label>
                {/if}
                <div class="col-12 col-sm-9">
                    {#if value[1]["type"] == "textarea"}
                        <textarea class="form-control" id="{value[0]}" rows="3" on:input={updateFormData(event,value[0])}></textarea>
                    {:else if value[1]["type"] == "select"}
                        <select class="form-control" id="{value[0]}" on:change={updateFormData(event, value[0])}>
                            <option value="">-- Select --</option>
                            {#each Object.entries(value[1]["data"]) as val, k}
                               <option value="{val[1][value[1]["valueData"]]}">{val[1][value[1]["textData"]]}</option>
                            {/each}
                        </select>
                    {:else if value[1]["type"] == "radio"}
                        {#each Object.entries(value[1]["data"]) as val, k}
                            <div class="form-check form-check-inline">
                                <input type="radio" id="{val[0]}" name="{value[0]}" value="{val[1][value[1]["valueData"]]}" on:change={updateFormData(event, value[0])}>
                                <label class="form-check-label" for="{value[0]}">{val[1][value[1]["textData"]]}</label>
                            </div>
                        {/each}
                    {:else if value[1]["type"] == "array"}
                    <br>
                    {:else}
                        <input type="{value[1]["type"]}" class="form-control" id="{value[0]}" placeholder="{value[1]["placeholder"]}" on:input={updateFormData(event, value[0])}>
                    {/if}
                </div>
            </div>
            {/each}
        </div>
        <div class="row mt-3 mr-3">
            <div class="col d-flex">
                <button class="btn btn-primary {setDisplayNone(!displayBack)}" on:click={back}> {txtBack}</button>
                <button class="btn btn-primary w-md align-self-end" style="margin-left: auto" on:click={submit}>{txtSubmit}</button>
            </div>
        </div>
        {:else}
        <div class="row">
            {#each Object.entries(schema) as value, key}
            {#if value[1]["type"] == "array"}
            <div class="col-12 {setDisplayNone(value[1]["hidden"])}">
                <label for="{value[0]}" class="col-sm-3 col-form-label">{value[1]["label"]}</label>
            </div>
            <ArrayField contentArray={value[1]["contentArray"]} {configFieldRow}></ArrayField>
            {/if}
            <div class="col-12 col-md-{recordRow(key)} {setDisplayNone(value[1]["hidden"])} mb-2 mt-2">
                {#if value[1]["type"] != "array"}
                <label for="{value[0]}" class="col-sm-3 col-form-label">{value[1]["label"]}</label>
                {/if}
                <div class="col-12 col-sm-9">
                    {#if value[1]["type"] == "textarea"}
                        <textarea class="form-control" id="{value[0]}" rows="3" on:input={updateArrayData(event,value[0])}>{valUpdateArray(value[0])}</textarea>
                    {:else if value[1]["type"] == "select"}
                        <select class="form-control" id="{value[0]}" value={valUpdateArray(value[0])} on:change={updateArrayData(event, value[0])}>
                            <option value="">-- Select --</option>
                            {#each Object.entries(value[1]["data"]) as val, k}
                               <option value="{val[1][value[1]["valueData"]]}">{val[1][value[1]["textData"]]}</option>
                            {/each}
                        </select>
                    {:else if value[1]["type"] == "radio"}
                        {#each Object.entries(value[1]["data"]) as val, k}
                            <div class="form-check form-check-inline">
                                <input type="radio" id="{val[0]}" name="{value[0]}" value="{val[1][value[1]["valueData"]]}" checked={compareUpdateChecked(val[1]?.[value[1]?.["valueData"]],arrayData[keyArray]?.[value[0]])} on:change={updateArrayData(event, value[0])}>
                                <label class="form-check-label" for="{value[0]}">{val[1][value[1]["textData"]]}</label>
                            </div>
                        {/each}
                    {:else if value[1]["type"] == "array"}
                    <br>
                    {:else}
                        <input type="{value[1]["type"]}" class="form-control" id="{value[0]}" placeholder="{value[1]["placeholder"]}" value={valUpdateArray(value[0])} on:input={updateArrayData(event, value[0])}>
                    {/if}
                </div>
            </div>
            {/each}
        </div>
        {/if}
    </form>
</div>