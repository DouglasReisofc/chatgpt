<?PHP
//
//
//Endereço IMAP do serviço de E-mail.
$mailbox = '{imap.uhserver.com:993/imap/ssl}INBOX';
// O Email que vai ser acessado.
$username = 'financeiro@clubevip.net';
//A senha do e-mail.
$password = 'CYRSG6vT86ZVfe';
//A senha para acesso a pagina.
$pagepw = '9359359';
//Titulo do SITE
$pagetitle = 'Código ChatGpt';
//Quantidade de Codigos buscados.
$quota2fa = 5;
//Quantidade de vezes que a pagina se atualizará automaticamente
$maxupdates = 5;
//Tempo entre as atualizações VALOR EM MILISEGUNDOS (1 SEGUNDO = 1000 MILISEGUNDOS)
$updateinterval = 30000;
//
//FUNÇOES GERAIS
function order_search($searchresults, $sortresults) {
    return array_values(array_intersect($sortresults,$searchresults));
}
//
//
?>