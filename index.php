<?php
include("config.php"); 
session_start();

// Conecta ao servidor de e-mails
$imapResource = imap_open($mailbox, $username, $password);

if ($imapResource === false) {
    die('Erro de conexão IMAP: ' . imap_last_error());
}

// Busca e-mails baseados no remetente e data
$search = 'FROM "noreply@tm.openai.com" SINCE "' . date("j F Y", strtotime("-1 day")) . '"';
$selectedemails = imap_search($imapResource, $search);
$sortemails = imap_sort($imapResource, SORTARRIVAL, 1);
$emails = order_search($selectedemails, $sortemails);

?>
<html lang="pt-br">

<head>
    <title><?PHP echo $pagetitle; ?></title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <link href="https://fonts.googleapis.com/css?family=DM+Sans:300,400,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="fonts/icomoon/style.css">
    <link rel="stylesheet" href="css/bootstrap.min.css">
    <link rel="stylesheet" href="css/bootstrap-datepicker.css">
    <link rel="stylesheet" href="css/jquery.fancybox.min.css">
    <link rel="stylesheet" href="css/owl.carousel.min.css">
    <link rel="stylesheet" href="css/owl.theme.default.min.css">
    <link rel="stylesheet" href="fonts/flaticon/font/flaticon.css">
    <link rel="stylesheet" href="css/aos.css">
    <link rel="stylesheet" href="css/style.css">

    <style>
        /* Estilos para o Preloader */
        .preloader {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8) url('loading.gif') no-repeat center center;
            z-index: 9999;
        }

        /* Estilos para o Header */
        .site-navbar {
            background-color: #333;
            padding: 20px 0;
        }
        .site-logo {
            text-align: center;
        }
        .site-logo img {
            width: 100px;
            border-radius: 50%;
        }

        /* Estilos para o Footer */
        footer {
            background-color: #333;
            color: #fff;
            padding: 20px 0;
            text-align: center;
        }

       /* Estilos para o Modal */
.modal {
    display: none;
    position: fixed;
    z-index: 1;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 500px;
    margin-top: 150px;
    background-color: transparent;
    padding-top: 20px;
    animation: fadeIn 0.5s ease-in-out;  /* Animação para o modal aparecer */
}

/* Animação para o Modal */
@keyframes fadeIn {
    0% {
        opacity: 0;
        transform: translate(-50%, -45%);
    }
    100% {
        opacity: 1;
        transform: translate(-50%, -50%);
    }
}

.modal-content {
    background: linear-gradient(145deg, #f9f9f9, #e0e0e0);  /* Gradiente para o fundo */
    padding: 25px;
    border-radius: 20px;
    text-align: center;
    box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);  /* Sombra suave para dar profundidade */
    color: #333;  /* Cor do texto */
    font-size: 1.2rem;  /* Aumentar o tamanho da fonte */
    line-height: 1.5;
    transition: transform 0.3s ease-in-out; /* Efeito de transformação ao passar o mouse */
}

.modal-content h2 {
    font-size: 2rem;  /* Tamanho maior para o título */
    font-weight: bold;
    color: #007bff;  /* Cor vibrante para o título */
    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);  /* Sombra no texto para destacar */
}

.modal-content p {
    font-size: 1rem;
    color: #555;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1); /* Sombra leve no parágrafo */
}

/* Estilo do botão */
.btn-entendi {
    background-color: #28a745;
    color: #fff;
    border: none;
    padding: 10px 20px;
    font-size: 16px;
    border-radius: 30px;
    cursor: pointer;
    transition: background-color 0.3s ease;  /* Animação no botão */
}

.btn-entendi:hover {
    background-color: #218838;
}

/* Fechar o modal com o botão "X" */
.close {
    color: #aaa;
    font-size: 28px;
    font-weight: bold;
    transition: color 0.3s ease;
}

.close:hover,
.close:focus {
    color: black;
    text-decoration: none;
    cursor: pointer;
}


        /* Estilo do botão */
        .btn-entendi {
            background-color: #28a745;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 14px;
            border-radius: 30px;
            cursor: pointer;
        }

        .btn-entendi:hover {
            background-color: #218838;
        }

        /* Tamanho do modal para mobile */
        @media (max-width: 768px) {
            .modal {
                width: 90%;
            }

            .modal-content {
                padding: 15px;
            }
        }

        /* Estilo dos cards */
        .post-entry-1 {
            background-color: #ffffff;
            border-radius: 20px; /* Bordas arredondadas para os cards */
            padding: 15px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            margin-bottom: 15px; /* Afastamento entre os cards */
        }

        /* Estilo do botão de copiar código */
        .copy-btn {
            background-color: #007bff;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            cursor: pointer;
        }

        .copy-btn:active {
            background-color: #0056b3;
        }

       /* Substitua a classe .update-button existente por isso */
.update-button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 15px;
    font-size: 12px;
    cursor: pointer;
    position: fixed; /* Fixa o botão na tela */
    top: 20px; /* Distância do topo */
    right: 20px; /* Distância da direita */
    z-index: 9999; /* Garante que fique acima de tudo */
    box-shadow: 0 2px 5px rgba(0,0,0,0.2); /* Sombra suave */
    transition: all 0.3s ease; /* Transição suave */
}

.update-button:hover {
    background-color: #0056b3;
    transform: scale(1.05); /* Efeito de hover leve */
}

        /* Espaçamento do campo de email */
        .email-content {
            margin-top: 50px; /* Distância maior do header */
        }

        /* Notificação de cópia */
        .copied-notification {
            color: green;
            font-weight: bold;
            margin-top: 10px;
        }
    </style>
</head>

<body data-spy="scroll" data-target=".site-navbar-target" data-offset="300">

    <!-- Preloader -->
    <div class="preloader" id="preloader"></div>

    <div class="site-wrap" id="home-section">
        <!-- Header -->
        <header class="site-navbar site-navbar-target" role="banner">
            <div class="container">
                <div class="row align-items-center position-relative">
                    <div class="col-lg-12">
                        <div class="site-logo">
                            <img src="images/dan2.png" alt="Logo"> <!-- Logo centralizado -->
                            <a href="index.php"><?PHP echo $pagetitle; ?></a>
                        </div>
                    </div> 
                </div>
            </div>
        </header>   

        <!-- Botão de Atualização (Agora está centralizado corretamente abaixo do título) -->
        <div class="update-button" onclick="updatePage()">Atualizar Página</div>

        <div class="site-section bg-dark">
            <div class="container">
                <h1 class="mb-3">&nbsp;</h1>

                <!-- Dados do Email (deslocados mais para baixo) -->
                <div class="email-content">
                    <?php
                    if (!empty($emails)) {
                        $printedmail = 0;
                        ?>
                        <div class="row align-items-stretch">
                            <?php
                            foreach ($emails as $email) {
                                $overview = imap_fetch_overview($imapResource, $email);
                                $overview = $overview[0];
                                $message = imap_fetchbody($imapResource, $email, 1, FT_PEEK);

                                $patternCode = '/(?:Your ChatGPT code is|=)\s*(\d{6})/'; 
                                $code = 'Código não encontrado';
                                $emailConta = 'E-mail não encontrado';

                                if (preg_match($patternCode, $message, $matchesCode)) {
                                    $code = $matchesCode[1];
                                }

                                $header = imap_fetchheader($imapResource, $email);
                                if (preg_match('/^X-X-Forwarded-For:\s*(.+)$/mi', $header, $matchesXForwarded)) {
                                    $forwardedEmails = explode(',', $matchesXForwarded[1]);
                                    foreach ($forwardedEmails as $forwardedEmail) {
                                        $trimmedEmail = trim($forwardedEmail);
                                        if (strpos($trimmedEmail, '@') !== false && $trimmedEmail !== 'aanniitaas@gmail.com') {
                                            $emailConta = $trimmedEmail;
                                            break;
                                        }
                                    }
                                } elseif (preg_match('/^Delivered-To:\s*(.+)$/mi', $header, $matchesDeliveredTo)) {
                                    $emailConta = trim($matchesDeliveredTo[1]);
                                }

                                if (strpos($emailConta, 'aanniitaas@gmail.com') !== false) {
                                    $emailConta = str_replace(' aanniitaas@gmail.com', '', $emailConta);
                                }
                                ?>
                                <div class="col-lg-4 col-md-6 mb-5">
                                    <div class="post-entry-1 h-100 person-1">    
                                        <img src="images/rdweb2.png" alt="Image" class="img-fluid" style="border-radius: 20px;">
                                        <div class="post-entry-1-contents">
                                            <span class="meta">Usuário ChatGpt:</span>
                                            <h2><?php echo htmlentities($emailConta); ?></h2>
                                            <p>Código: <strong id="code-<?php echo $printedmail; ?>"><?php echo htmlentities($code); ?></strong></p>
                                            <button class="copy-btn" onclick="copyCode('<?php echo $printedmail; ?>')">Copiar Código</button>
                                            <p id="copied-notification-<?php echo $printedmail; ?>" class="copied-notification" style="display:none;">! O código <?php echo htmlentities($code); ?> foi copiado.</p>
                                        </div>
                                    </div>
                                </div>
                                <?php
                                if (++$printedmail == $quota2fa) break;
                            }
                            ?>
                        </div>
                        <?php
                    } else {
                        echo 'Sem códigos para exibir. <br><br>';
                    }
                    ?>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <div id="alertModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Importante!</h2>
                <p>Por favor, não compre de revendedores que estão revendendo os Nossos produtos. Para sua segurança, adquira diretamente da fonte oficial.</p>
                <br>
                <p><a href="https://www.contasvip.com.br/" target="_blank" style="color: #007bff; text-decoration: none;">Clique aqui para visitar o site oficial</a></p>
                <button class="btn-entendi" onclick="closeModal()">Entendi</button>
            </div>
        </div>

        
<footer>
    <p>&copy; 2025 <a href="https://www.contasvip.com.br" target="_blank">Daniel Contas Premium</a>. Todos os direitos reservados.</p>
</footer>


        <script>
            window.onload = function() {
                document.getElementById('preloader').style.display = 'none';  // Esconde o preloader quando a página carrega
                // Mostrar o modal automaticamente ao carregar a página
                var modal = document.getElementById("alertModal");
                modal.style.display = "block";
            }

            var pageRefreshedByButton = false;  // Inicializa a flag como falsa

            // Modal functionality
            var modal = document.getElementById("alertModal");
            var span = document.getElementsByClassName("close")[0];

            // Fechar o modal quando clicar no "X"
            span.onclick = function() {
                modal.style.display = "none";
            }

            // Fechar o modal quando clicar fora dele
            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = "none";
                }
            }

            // Fechar o modal com o botão "Entendi"
            function closeModal() {
                modal.style.display = "none";
            }

            // Atualizar a página (sem mostrar o modal)
            function updatePage() {
                console.log("Botão de atualização clicado!");
                pageRefreshedByButton = true;  // Marca que o botão de atualização foi clicado
                location.reload();  // Atualiza a página
            }

            // Função para copiar o código
            function copyCode(id) {
                const codeElement = document.getElementById(`code-${id}`);
                const code = codeElement.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    const notification = document.getElementById(`copied-notification-${id}`);
                    notification.style.display = 'block';
                    setTimeout(() => {
                        notification.style.display = 'none';
                    }, 2000);
                });
            }
        </script>
    </body>
</html>
