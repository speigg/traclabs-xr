
<template>
    <div id="container">
        <div id="title"><img class="logo" src="/favicon.ico"/>Procedure: {{procedure}}</div>
        <div id="step">Step: {{step}}</div>
        <div id="instruction">{{instruction}}</div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend()
</script>

<style scoped>
    [id] {
        --layer-pixel-ratio: default!important;
    }
    #container {
        color:blue;
        /* background-color:rgba(255,255,255,0.7); */
        padding: 10px;
        border-width: 3px;
        border-color: black;
        border-style: solid;
        --layer-pixel-ratio: 0.2;
        font-family: 'Inconsolata', monospace;
        background: linear-gradient(#bef67dcc, #7aece2cc);
    }
    .logo {
        width: 20px;
        height: 20px;
        margin-right: 8px;
    }
    #title {
        /* background-color: transparent; */
        font-size: 20px;
        color:red;
        padding-bottom: 10px;
    }
    #step {
        font-size: 16px;
    }
    #instruction {
        padding: 4px;
        background-color: white;
        color: black;
        border-radius: 5px;
    }
</style>