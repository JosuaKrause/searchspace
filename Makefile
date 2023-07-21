help:
	@echo "The following make targets are available:"
	@echo "run-web	run a simple web server to serve the files"
	@echo "convert	convert a webm file to gif"

run-web:
	python -m http.server 9000

convert:
	INPUT=$(INPUT) ./sh/webm2gif.sh
