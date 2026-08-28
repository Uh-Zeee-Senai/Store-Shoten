<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');

const STORE = __DIR__ . '/data/store.json';

function respond(array $data, int $status = 200): void { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function readStore(): array {
    if (!file_exists(STORE)) {
        $seed = ['nextId' => 4, 'users' => [
            ['id'=>1,'name'=>'Administrador Jashin','email'=>'admin@jashin.local','password'=>password_hash('admin123', PASSWORD_DEFAULT),'role'=>'admin','createdAt'=>date('c')],
            ['id'=>2,'name'=>'Cliente Demonstração','email'=>'cliente@jashin.local','password'=>password_hash('cliente123', PASSWORD_DEFAULT),'role'=>'client','createdAt'=>date('c')]
        ], 'books' => [
            ['id'=>1,'title'=>'O Hobbit','author'=>'J. R. R. Tolkien','publisher'=>'HarperCollins','edition'=>'Capa dura','barcode'=>'9788595084742','price'=>59.90,'stock'=>8,'description'=>'Uma aventura clássica pela Terra-média.','image'=>'','active'=>true],
            ['id'=>2,'title'=>'O Senhor dos Anéis: A Sociedade do Anel','author'=>'J. R. R. Tolkien','publisher'=>'HarperCollins','edition'=>'Edição especial','barcode'=>'9788595086357','price'=>79.90,'stock'=>5,'description'=>'O primeiro volume da jornada do Anel.','image'=>'','active'=>true]
        ], 'requests'=>[], 'orders'=>[]];
        if (!is_dir(dirname(STORE))) mkdir(dirname(STORE), 0775, true);
        file_put_contents(STORE, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    return json_decode(file_get_contents(STORE), true) ?: [];
}
function saveStore(array $store): void { file_put_contents(STORE, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX); }
function body(): array { $data = json_decode(file_get_contents('php://input'), true); return is_array($data) ? $data : $_POST; }
function user(array $store): ?array { foreach ($store['users'] as $u) if (($u['id'] ?? 0) === ($_SESSION['user_id'] ?? 0)) return $u; return null; }
function publicUser(?array $u): ?array { return $u ? ['id'=>$u['id'],'name'=>$u['name'],'email'=>$u['email'],'role'=>$u['role']] : null; }
function requireUser(array $store): array { $u = user($store); if (!$u) respond(['error'=>'Faça login para continuar.'],401); return $u; }
function requireAdmin(array $store): array { $u=requireUser($store); if ($u['role'] !== 'admin') respond(['error'=>'Acesso permitido apenas ao administrador.'],403); return $u; }
function nextId(array &$store): int { return $store['nextId']++; }

$action = $_GET['action'] ?? '';
$store = readStore();
$current = user($store);

if ($action === 'bootstrap') respond(['user'=>publicUser($current)]);
if ($action === 'register') {
    $d=body(); $email=strtolower(trim($d['email']??'')); $name=trim($d['name']??''); $password=$d['password']??'';
    if (!$name || !filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($password)<6) respond(['error'=>'Informe nome, e-mail válido e senha com ao menos 6 caracteres.'],422);
    foreach($store['users'] as $u) if($u['email']===$email) respond(['error'=>'Este e-mail já está cadastrado.'],422);
    $u=['id'=>nextId($store),'name'=>$name,'email'=>$email,'password'=>password_hash($password,PASSWORD_DEFAULT),'role'=>'client','createdAt'=>date('c')]; $store['users'][]=$u; saveStore($store); $_SESSION['user_id']=$u['id']; respond(['user'=>publicUser($u)]);
}
if ($action === 'login') {
    $d=body(); $email=strtolower(trim($d['email']??'')); foreach($store['users'] as $u) if($u['email']===$email && password_verify($d['password']??'', $u['password'])) { $_SESSION['user_id']=$u['id']; respond(['user'=>publicUser($u)]); } respond(['error'=>'E-mail ou senha incorretos.'],401);
}
if ($action === 'logout') { session_destroy(); respond(['ok'=>true]); }
if ($action === 'account-update') {
    $u=requireUser($store); $d=body(); $name=trim($d['name']??''); $password=$d['password']??'';
    if(!$name) respond(['error'=>'Informe seu nome.'],422);
    foreach($store['users'] as &$item) if($item['id']===$u['id']) { $item['name']=$name; if($password!=='') { if(strlen($password)<6) respond(['error'=>'A nova senha deve ter ao menos 6 caracteres.'],422); $item['password']=password_hash($password,PASSWORD_DEFAULT); } $u=$item; break; } unset($item);
    saveStore($store); respond(['user'=>publicUser($u)]);
}
if ($action === 'books') respond(['books'=>array_values(array_filter($store['books'],fn($b)=>$b['active'] && $b['stock']>0))]);
if ($action === 'my-data') { $u=requireUser($store); respond(['requests'=>array_values(array_filter($store['requests'],fn($r)=>$r['userId']===$u['id'])),'orders'=>array_values(array_filter($store['orders'],fn($o)=>$o['userId']===$u['id']))]); }
if ($action === 'request-create') {
    $u=requireUser($store); $d=body(); foreach(['title','author','edition'] as $f) if(!trim($d[$f]??'')) respond(['error'=>'Preencha título, autor e edição.'],422);
    $store['requests'][]=['id'=>nextId($store),'userId'=>$u['id'],'userName'=>$u['name'],'title'=>trim($d['title']),'author'=>trim($d['author']),'publisher'=>trim($d['publisher']??''),'edition'=>trim($d['edition']),'notes'=>trim($d['notes']??''),'status'=>'Recebida','createdAt'=>date('c')]; saveStore($store); respond(['ok'=>true]);
}
if ($action === 'checkout') {
    $u=requireUser($store); $d=body(); $items=$d['items']??[]; if(!$items) respond(['error'=>'Sua sacola está vazia.'],422); $total=0; $orderItems=[];
    foreach($items as $item) { foreach($store['books'] as &$book) if($book['id']===(int)$item['id']) { $qty=max(1,(int)$item['quantity']); if($book['stock']<$qty) respond(['error'=>"Estoque insuficiente para {$book['title']}."],422); $book['stock']-=$qty; $total+=$book['price']*$qty; $orderItems[]=['bookId'=>$book['id'],'title'=>$book['title'],'quantity'=>$qty,'price'=>$book['price']]; break; } unset($book); }
    $store['orders'][]=['id'=>nextId($store),'userId'=>$u['id'],'userName'=>$u['name'],'items'=>$orderItems,'total'=>$total,'status'=>'Pedido recebido','paymentStatus'=>'Aguardando pagamento','deliveryMethod'=>$d['deliveryMethod'] ?? 'Retirada na loja','address'=>trim($d['address'] ?? ''),'createdAt'=>date('c')]; saveStore($store); respond(['ok'=>true]);
}
if ($action === 'admin-data') { requireAdmin($store); $sales=array_sum(array_column($store['orders'],'total')); $clients=array_map(fn($u)=>publicUser($u),array_filter($store['users'],fn($u)=>$u['role']==='client')); $lowStock=array_values(array_filter($store['books'],fn($b)=>$b['stock']<=3)); respond(['books'=>$store['books'],'requests'=>$store['requests'],'orders'=>$store['orders'],'clients'=>$clients,'lowStock'=>$lowStock,'stats'=>['sales'=>$sales,'orders'=>count($store['orders']),'requests'=>count($store['requests']),'stock'=>array_sum(array_column($store['books'],'stock'))]]); }
if ($action === 'book-save') {
    requireAdmin($store); $d=body(); foreach(['title','author','price','stock'] as $f) if($d[$f]===''||!isset($d[$f])) respond(['error'=>'Preencha título, autor, preço e estoque.'],422);
    $book=['title'=>trim($d['title']),'author'=>trim($d['author']),'publisher'=>trim($d['publisher']??''),'edition'=>trim($d['edition']??''),'barcode'=>trim($d['barcode']??''),'price'=>(float)$d['price'],'stock'=>(int)$d['stock'],'description'=>trim($d['description']??''),'image'=>trim($d['image']??''),'active'=>true];
    if(!empty($d['id'])) { foreach($store['books'] as &$b) if($b['id']===(int)$d['id']) { $book['id']=$b['id']; $b=$book; break; } unset($b); } else { $book['id']=nextId($store); $store['books'][]=$book; } saveStore($store); respond(['ok'=>true]);
}
if ($action === 'request-status') { requireAdmin($store); $d=body(); foreach($store['requests'] as &$r) if($r['id']===(int)$d['id']) $r['status']=$d['status']; unset($r); saveStore($store); respond(['ok'=>true]); }
if ($action === 'order-status') { requireAdmin($store); $d=body(); foreach($store['orders'] as &$o) if($o['id']===(int)$d['id']) { $o['status']=$d['status']; if(isset($d['paymentStatus'])) $o['paymentStatus']=$d['paymentStatus']; } unset($o); saveStore($store); respond(['ok'=>true]); }
respond(['error'=>'Ação inválida.'],404);
