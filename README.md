# ChatGPT Codes System

Sistema unificado de acesso a códigos do ChatGPT com autenticação por email e MongoDB local automático.

## 🚀 Instalação Automática (Sem configuração manual!)

### Pré-requisitos
Apenas **Node.js** - [Download aqui](https://nodejs.org/)

### Instalação Completa Automática
```bash
# Clone ou baixe o projeto
cd chatgpt-codes-system

# Instale as dependências (MongoDB será baixado e configurado automaticamente!)
npm install
```

**Isso é tudo!** O sistema irá:
- ✅ Baixar o MongoDB automaticamente para o projeto
- ✅ Configurar tudo localmente (sem afetar o sistema)
- ✅ Criar todas as configurações necessárias
- ✅ Preparar o banco de dados

## 🎯 Como Usar

### Opção 1: Início Automático (Recomendado)
```bash
# Inicia MongoDB e a aplicação automaticamente
start.bat
```

### Opção 2: Início Manual
```bash
# 1. Inicie o MongoDB manualmente
mongod --config mongod.conf

# 2. Em outro terminal, inicie a aplicação
npm start
```

### Opção 3: Modo Desenvolvimento
```bash
# Para desenvolvimento com auto-reload
npm run dev
```

## 🌐 Acesso

Após iniciar, acesse: **http://localhost:8000**

## 📁 Estrutura do Projeto

```
chatgpt-codes-system/
├── index.js              # Aplicação principal
├── package.json           # Dependências e scripts
├── mongod.conf           # Configuração do MongoDB
├── start.bat             # Script de início automático
├── install.js            # Script de instalação
├── init-database.js      # Inicialização do banco
├── mongodb-data/         # Dados do MongoDB (criado automaticamente)
├── mongodb-logs/         # Logs do MongoDB (criado automaticamente)
├── rotas/               # Rotas da aplicação
│   ├── auth.js          # Autenticação
│   └── codes.js         # Gerenciamento de códigos
├── views/               # Templates EJS
├── public/              # Arquivos estáticos
└── README.md            # Este arquivo
```

## 🔧 Scripts Disponíveis

- `npm install` - Instala dependências e configura o projeto
- `npm start` - Inicia a aplicação
- `npm run dev` - Modo desenvolvimento com nodemon
- `npm run init-db` - Inicializa apenas o banco de dados
- `start.bat` - Inicia MongoDB e aplicação (Windows)

## 🛠️ Solução de Problemas

### MongoDB não inicia
1. Execute `start.bat` novamente - ele tentará baixar e instalar o MongoDB local automaticamente
2. Verifique os logs em `mongodb-logs/mongod.log`
3. Se necessário, delete a pasta `mongodb-local` e execute `npm install` novamente

### Erro de conexão
1. Certifique-se que a porta 27017 não está em uso por outro MongoDB
2. Verifique os logs em `mongodb-logs/mongod.log`
3. Se necessário, reinicie o computador e tente novamente

### Porta 8000 em uso
- Altere a porta no arquivo `index.js` ou defina a variável de ambiente `PORT`

## 📋 Funcionalidades

- ✅ Autenticação por email com código de verificação
- ✅ Sistema de sessões
- ✅ Gerenciamento de códigos do ChatGPT
- ✅ Interface web responsiva
- ✅ Logs de acesso
- ✅ MongoDB local automático (sem instalação manual!)
- ✅ Inicialização automática do banco de dados

## 🔒 Segurança

- Códigos de verificação expiram em 10 minutos
- Sessões seguras com cookies
- Índices únicos para emails
- Logs de acesso para auditoria
- MongoDB isolado localmente no projeto

## 📞 Suporte

Se encontrar problemas:
1. Execute `start.bat` - ele tentará corrigir problemas automaticamente
2. Verifique os logs em `mongodb-logs/mongod.log`
3. Delete a pasta `mongodb-local` e execute `npm install` para reinstalar
4. Se o problema persistir, abra uma issue no GitHub
