provision:
	mkdir -p build/workspace
	echo "<h1>reference-stack-demo is up</h1>" > build/workspace/index.html
	echo "provisioned at $$(date)" >> build/workspace/index.html
