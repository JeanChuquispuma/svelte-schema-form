<script>
    export let listTitle = "List Title"
    export let sizeModal = "lg" //xl, lg or sm

    export let contentData = []
    export let returnValue
    export let posValue = 0
    export let posText = 1

    let modalVisible = false 
    let parameterVisible = ["",""]

    let tempContentData = contentData

    let lblSearch = ""
    let contFocus = 0
    let textInput = ""

    const actionEnter = (e) => {
        if(e.key == "Enter" || e.pointerType == "touch") {
            modalVisible = true
        }
    }

    const closeModal = () => {
        modalVisible = false
    }

    const content = () => {
        console.log(contentData)
    }

    const searching = (e) => {
        let value = e.target.value
        let tmpOfTmp = tempContentData.filter(v=> Object.keys(v).filter(key=> v[key].toString().toLowerCase().includes(value.toString().toLowerCase())).length > 0)
        if(tmpOfTmp.length <= 0){
            lblSearch = 'Data not found'
            tempContentData = contentData
        }else{
            lblSearch = ''
            if (value != "") {
                tempContentData = tempContentData.filter(v=> Object.keys(v).filter(key=> v[key].toString().toLowerCase().includes(value.toString().toLowerCase())).length > 0)            
            }else{
                tempContentData = contentData
            }
        }

        contFocus = 0

        console.log(tempContentData)
    }

    const selectFocus = (e) => {
        let min = 0
        let max = tempContentData.length - 1
        if(e.key == 'ArrowDown'){
            if(contFocus >= min && contFocus < max){
                contFocus += 1
            }
        }else if(e.key == 'ArrowUp'){
            if(contFocus > min && contFocus <= max){
                contFocus -= 1
            }
        }else if(e.key == 'Enter'){
            select()
            closeModal()
        }
    }

    function select(){
        let selectData = tempContentData[contFocus]
        returnValue = Object.values(selectData)[posValue]
        textInput = Object.values(selectData)[posText]
    }
    
    function selectMobile(event, key){
        contFocus = key
        let selectData = tempContentData[contFocus]
        returnValue = Object.values(selectData)[posValue]
        textInput = Object.values(selectData)[posText]
        closeModal()
    }

    $: if(modalVisible){
        parameterVisible[0] = "show"
        parameterVisible[1] = "display:block;"
    }else{
        parameterVisible[0] = ""
        parameterVisible[1] = "display:none;"
    }

</script>

<div class="modal fade {parameterVisible[0]}" role="dialog" tabindex="-1" style="{parameterVisible[1]}">
    <div class="modal-dialog modal-{sizeModal}" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">{listTitle}</h5>
                
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" on:click={closeModal}></button>
            </div>
            <div class="modal-body">

                <input type="search" class="form-control" placeholder="Search" on:input={searching} on:keydown={selectFocus} autofocus/>
                <label for="search" style="font-size: 0.7rem; color: red;">{lblSearch}</label>

                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                            {#each Object.keys(tempContentData[0]) as key}
                                <th>{key} </th>
                            {/each}
                            </tr>
                        </thead>
                        <tbody>
                            {#each tempContentData as value, key}
                                {#if key == contFocus}
                                    <tr class='bg bg-primary text-white' on:click={()=>{selectMobile(event, key)}}>
                                        {#each Object.entries(value) as val, key}
                                        {#if key == 0}
                                            <th scope="row">{val[1]}</th>
                                        {:else}
                                            <td>{val[1]}</td>
                                        {/if}    
                                        {/each}
                                    </tr>
                                {:else}
                                    <tr on:click={()=>{selectMobile(event, key)}}>
                                        {#each Object.entries(value) as val, key}
                                        {#if key == 0}
                                            <th scope="row">{val[1]}</th>
                                        {:else}
                                            <td>{val[1]}</td>
                                        {/if}    
                                        {/each}
                                    </tr>
                                {/if}
                            {/each}
                        </tbody>
                    </table>
                </div>

            </div>
            <div class="modal-footer">
                <button type="button" on:click={closeModal} class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->

<input type="text" class="form-control" value={textInput} readonly on:keydown={actionEnter} on:click={actionEnter} placeholder="Select Value"/>

<style>
    .modal{
        background-color: rgba(0, 0, 0, 0.3); 
    }
</style>