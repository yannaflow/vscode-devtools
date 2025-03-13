# VSCode DevTools

## Configurações

Este projeto utiliza as seguintes configurações para o TypeScript e o ambiente de desenvolvimento:

```json
{
  "files.include": {
    "true": true // Defina isso como true para mostrar a pasta "true" com os arquivos JS compilados
  },
  "search.include": {
    "true": true // Defina isso como true para incluir a pasta "true" nos resultados da pesquisa
  },
  "typescript.tsdk": "./node_modules/typescript/lib", // Queremos usar o servidor TS da nossa pasta node_modules para validar sua versão
  "typescript.tsc.autoDetect": "on" // Habilita a detecção automática de tarefas executáveis ou em execução do tsc, pois deve conter tarefas, como scripts npm
}