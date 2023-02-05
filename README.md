# svelte-schema-forms

Schema Forms to Json for Svelte

## Install
```bash
npm i svelte-schema-forms
```

## Example
```svelte
<script>
    import {SchemaForm} from 'svelte-schema-form'
    let configFormRow = [3,2,2]
    let configFieldRow = [3,3,3,3,3,3,3]
    let schema = {
      "title": {
        "label" : "Title",
        "type": "text",
        "class" : "form-control-plaintext",
        "placeholder" : "Ingrese titulo",
        "hidden" : false
      },
      "description": {
        "label" : "Description",
        "type": "text",
        "placeholder" : "Ingrese Descripción"
      },
      "seleccion": {
        "label" : "Seleccion",
        "type": "select",
        "data": [
          {
            "valor1" : "SOLTERO",
            "valor2" : "1"
          },
          {
            "valor1" : "CASADO",
            "valor2" : "2"
          },
          {
            "valor1" : "VIUDO",
            "valor2" : "3"
          },
          {
            "valor1" : "DIVORCIADO",
            "valor2" : "4"
          }
        ],
        "valueData" : "valor2",
        "textData" : "valor1"
      },
      "radio": {
        "label" : "radio",
        "type": "radio",
        "data": [
          {
            "valor1" : "SOLTERO",
            "valor2" : "1"
          },
          {
            "valor1" : "CASADO",
            "valor2" : "2"
          },
          {
            "valor1" : "VIUDO",
            "valor2" : "3"
          },
          {
            "valor1" : "DIVORCIADO",
            "valor2" : "4"
          }
        ],
        "valueData" : "valor2",
        "textData" : "valor1"
      },
      "description4": {
        "label" : "Description4",
        "type": "textarea"
      },
      "array": {
        "label" : "Array",
        "type": "array",
        "contentArray" : {
          "texto1" : {
            "label" : "TextoArray1",
            "type" : "text"
          },
          "texto2" : {
            "label" : "TextoArray2",
            "type" : "textarea"
          },
          "seleccion": {
            "label" : "Seleccion",
            "type": "select",
            "data": [
              {
                "valor1" : "SOLTERO",
                "valor2" : "1"
              },
              {
                "valor1" : "CASADO",
                "valor2" : "2"
              },
              {
                "valor1" : "VIUDO",
                "valor2" : "3"
              },
              {
                "valor1" : "DIVORCIADO",
                "valor2" : "4"
              }
            ],
            "valueData" : "valor2",
            "textData" : "valor1"
          },
          "radioArray":{
            "label" : "radioArray",
            "type" : "radio",
            "data" : [
              {
                "valor1" : "Masculino",
                "valor2" : "1"
              },
              {
                "valor1" : "Femenino",
                "valor2" : "2"
              }
            ],
            "valueData" : "valor2",
            "textData" : "valor1"
          },
        },
      },
      "description6": {
        "label" : "Description",
        "type": "textarea",
        "hidden" : true
      }
    }
  
    const handleSubmit = (data) => {
      // Handle Submit here.
      console.log(data)
    }
  
    const handleChange = (data) => {
      // Handle Change here.
    }

    let formData = {}

  </script>
        <SchemaForm
        {schema}
        {configFormRow}
        {configFieldRow}
        {formData}
        txtSubmit = "Siguiente"
        txtBack = "Atras"
        displayBack = true

        onSubmit={handleSubmit}
        onBack={handleChange}
/>

  
```
