<?php
header('Content-Type: application/json');

// Replicate API Token
$REPLICATE_API_TOKEN = "YOUR_REPLICATE_API_TOKEN_HERE"; 

$inputData = json_decode(file_get_contents('php://input'), true);
$prompt = $inputData['prompt'] ?? '';
$type = $inputData['type'] ?? 'image'; 

if (empty($prompt)) {
    echo json_encode(['error' => 'Prompt is required']);
    exit;
}

if ($type === 'video') {
    $version = "lucataco/luma-dream-machine";
    $input = [
        "prompt" => $prompt,
        "aspect_ratio" => "16:9"
    ];
} else {
    $version = "black-forest-labs/flux-schnell";
    $input = [
        "prompt" => $prompt,
        "aspect_ratio" => "16:9",
        "output_format" => "webp"
    ];
}

$ch = curl_init("https://api.replicate.com/v1/predictions");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Token " . $REPLICATE_API_TOKEN,
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "version" => $version,
    "input" => $input
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

$prediction = json_decode($response, true);

if (isset($prediction['id'])) {
    $predictionId = $prediction['id'];
    $status = $prediction['status'];

    while ($status !== 'succeeded' && $status !== 'failed') {
        sleep(2);
        
        $ch = curl_init("https://api.replicate.com/v1/predictions/" . $predictionId);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Token " . $REPLICATE_API_TOKEN
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $pollResponse = curl_exec($ch);
        curl_close($ch);
        
        $prediction = json_decode($pollResponse, true);
        $status = $prediction['status'];
    }

    if ($status === 'succeeded') {
        echo json_encode([
            'success' => true,
            'output' => $prediction['output'],
            'type' => $type
        ]);
    } else {
        echo json_encode(['error' => 'Generation failed on Replicate.']);
    }
} else {
    echo json_encode(['error' => 'API Error or Invalid Token']);
}
?>